const DESKTOP_COMMANDS: &[&str] = &[
    "choose_export_destination",
    "clear_recovery_snapshot",
    "close_after_save",
    "has_recovery_snapshot",
    "list_recent_projects",
    "open_external",
    "open_project",
    "open_recent_project",
    "open_recovery_snapshot",
    "pick_input_files",
    "read_input_file",
    "save_project",
    "save_recovery_snapshot",
    "set_dirty_state",
    "start_new_project",
    "write_export",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(DESKTOP_COMMANDS)),
    )
    .expect("failed to build the BRIGX desktop application");
}
