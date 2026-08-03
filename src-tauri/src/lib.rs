mod commands;
mod menu;
mod model;
mod project_store;
mod validation;

use commands::DesktopState;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use tauri::webview::NewWindowResponse;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogResult};

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _working_directory| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        );

    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .setup(|app| {
            let user_data_directory = user_data_directory(app)?;
            fs::create_dir_all(&user_data_directory)?;
            app.manage(DesktopState::new(project_store::ProjectStore::new(
                app.package_info().version.to_string(),
                user_data_directory,
            )));

            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("BRIGX")
                    .inner_size(1440.0, 960.0)
                    .min_inner_size(1024.0, 720.0)
                    .background_color(tauri::window::Color(16, 24, 39, 255))
                    .on_navigation(is_allowed_navigation)
                    .on_new_window(|_url, _features| NewWindowResponse::Deny)
                    .build()?;
            window.show()?;
            menu::rebuild_application_menu(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .on_menu_event(|app, event| menu::handle_menu_event(app, event.id().as_ref()))
        .on_window_event(handle_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::choose_export_destination,
            commands::clear_recovery_snapshot,
            commands::close_after_save,
            commands::has_recovery_snapshot,
            commands::list_recent_projects,
            commands::open_external,
            commands::open_project,
            commands::open_recent_project,
            commands::open_recovery_snapshot,
            commands::pick_input_files,
            commands::read_input_file,
            commands::save_project,
            commands::save_recovery_snapshot,
            commands::set_dirty_state,
            commands::start_new_project,
            commands::write_export,
        ])
        .run(tauri::generate_context!())
        .expect("BRIGX desktop runtime failed");
}

fn is_allowed_navigation(url: &url::Url) -> bool {
    let production_origin = (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (url.scheme() == "http" && url.host_str() == Some("tauri.localhost"));
    let development_origin = cfg!(debug_assertions)
        && url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && url.port() == Some(5173);
    production_origin || development_origin
}

fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    let app = window.app_handle();
    let state = app.state::<DesktopState>();
    if state.allow_close.load(Ordering::SeqCst) || !state.dirty.load(Ordering::SeqCst) {
        return;
    }
    api.prevent_close();
    if state.close_prompt_open.swap(true, Ordering::SeqCst) {
        return;
    }

    let callback_app = app.clone();
    app.dialog()
        .message("Save changes before closing?\n\nBRIGX also keeps a local recovery snapshot for unexpected exits.")
        .title("Unsaved BRIGX project")
        .buttons(MessageDialogButtons::YesNoCancelCustom(
            "Save".to_owned(),
            "Discard".to_owned(),
            "Cancel".to_owned(),
        ))
        .show_with_result(move |result| {
            let state = callback_app.state::<DesktopState>();
            state.close_prompt_open.store(false, Ordering::SeqCst);
            match result {
                MessageDialogResult::Yes => {
                    let _ = callback_app.emit(
                        "brigx:menu-action",
                        serde_json::json!({ "type": "save-and-close" }),
                    );
                }
                MessageDialogResult::Custom(ref label) if label == "Save" => {
                    let _ = callback_app.emit(
                        "brigx:menu-action",
                        serde_json::json!({ "type": "save-and-close" }),
                    );
                }
                MessageDialogResult::No => {
                    state.allow_close.store(true, Ordering::SeqCst);
                    if let Some(window) = callback_app.get_webview_window("main") {
                        let _ = window.close();
                    }
                }
                MessageDialogResult::Custom(ref label) if label == "Discard" => {
                    state.allow_close.store(true, Ordering::SeqCst);
                    if let Some(window) = callback_app.get_webview_window("main") {
                        let _ = window.close();
                    }
                }
                _ => {}
            }
        });
}

fn user_data_directory(app: &tauri::App) -> tauri::Result<PathBuf> {
    #[cfg(feature = "e2e")]
    if let Some(path) = std::env::var_os("BRIGX_E2E_USER_DATA_DIR") {
        return Ok(PathBuf::from(path));
    }
    app.path().app_data_dir()
}
