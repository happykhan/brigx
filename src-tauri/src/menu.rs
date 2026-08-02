use crate::commands::DesktopState;
use serde_json::json;
use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

pub fn rebuild_application_menu(app: &AppHandle) -> Result<(), String> {
    let recent = app
        .state::<DesktopState>()
        .store
        .lock()
        .map_err(|_| "Internal project store lock is unavailable".to_owned())?
        .list_recent_projects()?;

    let new_project = MenuItemBuilder::with_id("file:new", "New Project")
        .accelerator("CmdOrCtrl+N")
        .build(app)
        .map_err(context("Could not create the New Project menu item"))?;
    let open_project = MenuItemBuilder::with_id("file:open", "Open Project…")
        .accelerator("CmdOrCtrl+O")
        .build(app)
        .map_err(context("Could not create the Open Project menu item"))?;
    let save_project = MenuItemBuilder::with_id("file:save", "Save Project")
        .accelerator("CmdOrCtrl+S")
        .build(app)
        .map_err(context("Could not create the Save Project menu item"))?;
    let save_as = MenuItemBuilder::with_id("file:save-as", "Save Project As…")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)
        .map_err(context("Could not create the Save As menu item"))?;
    let recover = MenuItemBuilder::with_id("file:recover", "Recover Last Session")
        .build(app)
        .map_err(context("Could not create the recovery menu item"))?;
    let quit = MenuItemBuilder::with_id("file:quit", "Quit BRIGX")
        .accelerator("CmdOrCtrl+Q")
        .build(app)
        .map_err(context("Could not create the Quit menu item"))?;

    let mut recent_builder = SubmenuBuilder::new(app, "Open Recent");
    if recent.is_empty() {
        let empty = MenuItemBuilder::with_id("recent:none", "No Recent Projects")
            .enabled(false)
            .build(app)
            .map_err(context("Could not create the recent-project placeholder"))?;
        recent_builder = recent_builder.item(&empty);
    } else {
        for project in recent {
            let item =
                MenuItemBuilder::with_id(format!("recent:{}", project.id), project.display_name)
                    .build(app)
                    .map_err(context("Could not create a recent-project menu item"))?;
            recent_builder = recent_builder.item(&item);
        }
    }
    let recent_menu = recent_builder
        .build()
        .map_err(context("Could not create the recent-project menu"))?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_project)
        .item(&open_project)
        .item(&recent_menu)
        .separator()
        .item(&save_project)
        .item(&save_as)
        .item(&recover)
        .separator()
        .item(&quit)
        .build()
        .map_err(context("Could not create the File menu"))?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .map_err(context("Could not create the Edit menu"))?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .fullscreen()
        .build()
        .map_err(context("Could not create the View menu"))?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .build()
        .map_err(context("Could not create the Window menu"))?;
    let source = MenuItemBuilder::with_id("help:source", "BRIGX Source and Documentation")
        .build(app)
        .map_err(context("Could not create the documentation menu item"))?;
    let issues = MenuItemBuilder::with_id("help:issues", "Report an Issue")
        .build(app)
        .map_err(context("Could not create the issue menu item"))?;
    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&source)
        .item(&issues)
        .build()
        .map_err(context("Could not create the Help menu"))?;

    let menu = Menu::new(app).map_err(context("Could not create the application menu"))?;
    #[cfg(target_os = "macos")]
    {
        let app_menu = SubmenuBuilder::new(app, "BRIGX")
            .about(None)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .build()
            .map_err(context("Could not create the BRIGX menu"))?;
        menu.append(&app_menu)
            .map_err(context("Could not add the BRIGX menu"))?;
    }
    for submenu in [&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu] {
        menu.append(submenu)
            .map_err(context("Could not add an application submenu"))?;
    }
    app.set_menu(menu)
        .map_err(context("Could not install the application menu"))?;
    Ok(())
}

pub fn handle_menu_event(app: &AppHandle, id: &str) {
    let payload = match id {
        "file:new" => Some(json!({ "type": "new-project" })),
        "file:open" => Some(json!({ "type": "open-project" })),
        "file:save" => Some(json!({ "type": "save-project" })),
        "file:save-as" => Some(json!({ "type": "save-project-as" })),
        "file:recover" => Some(json!({ "type": "recover-project" })),
        value if value.starts_with("recent:") && value != "recent:none" => Some(json!({
            "type": "open-recent",
            "id": value.trim_start_matches("recent:")
        })),
        _ => None,
    };
    if let Some(payload) = payload {
        let _ = app.emit("brigx:menu-action", payload);
        return;
    }

    match id {
        "file:quit" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
            }
        }
        "help:source" => {
            let _ = app
                .opener()
                .open_url("https://github.com/happykhan/brigx", None::<&str>);
        }
        "help:issues" => {
            let _ = app
                .opener()
                .open_url("https://github.com/happykhan/brigx/issues", None::<&str>);
        }
        _ => {}
    }
}

fn context<E: std::fmt::Display>(message: &'static str) -> impl FnOnce(E) -> String {
    move |error| format!("{message}: {error}")
}
