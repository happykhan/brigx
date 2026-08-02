use crate::menu::rebuild_application_menu;
use crate::model::{
    OpenProjectResult, OpenedFile, PendingExportResult, PickInputFilesRequest, RecentProject,
    SaveProjectRequest, SaveResult,
};
use crate::project_store::{
    MAX_EXPORT_BYTES, MAX_PROJECT_FILES, MAX_TOTAL_INPUT_BYTES, ProjectStore,
    write_bytes_atomically,
};
use std::collections::HashMap;
#[cfg(feature = "e2e")]
use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use url::Url;
use uuid::Uuid;

const PROJECT_EXTENSIONS: &[&str] = &["brigx"];
const REFERENCE_EXTENSIONS: &[&str] = &["fasta", "fa", "fna", "gbk", "gb", "gbff", "genbank", "gz"];
const RING_EXTENSIONS: &[&str] = &[
    "fasta", "fa", "fna", "gbk", "gb", "gbff", "genbank", "gz", "graph", "bedgraph", "wig", "bed",
    "sam",
];
const MAX_FILENAME_BYTES: usize = 255;
const MAX_EXTERNAL_URL_BYTES: usize = 2_048;

#[derive(Debug)]
struct PendingExport {
    destination: PathBuf,
    expected_size: u64,
}

pub struct DesktopState {
    pub store: Mutex<ProjectStore>,
    pending_exports: Mutex<HashMap<String, PendingExport>>,
    pub dirty: AtomicBool,
    pub allow_close: AtomicBool,
    pub close_prompt_open: AtomicBool,
    #[cfg(feature = "e2e")]
    test_dialogs: Mutex<TestDialogQueues>,
}

impl DesktopState {
    pub fn new(store: ProjectStore) -> Self {
        Self {
            store: Mutex::new(store),
            pending_exports: Mutex::new(HashMap::new()),
            dirty: AtomicBool::new(false),
            allow_close: AtomicBool::new(false),
            close_prompt_open: AtomicBool::new(false),
            #[cfg(feature = "e2e")]
            test_dialogs: Mutex::new(TestDialogQueues::from_environment()),
        }
    }
}

#[cfg(feature = "e2e")]
#[derive(Default)]
struct TestDialogQueues {
    input_paths: VecDeque<Vec<PathBuf>>,
    open_paths: VecDeque<PathBuf>,
    save_paths: VecDeque<PathBuf>,
}

#[cfg(feature = "e2e")]
impl TestDialogQueues {
    fn from_environment() -> Self {
        Self {
            input_paths: parse_path_queue("BRIGX_E2E_PICK_PATHS"),
            open_paths: parse_single_path_queue("BRIGX_E2E_OPEN_PATHS"),
            save_paths: parse_single_path_queue("BRIGX_E2E_SAVE_PATHS"),
        }
    }
}

#[cfg(feature = "e2e")]
fn parse_path_queue(variable: &str) -> VecDeque<Vec<PathBuf>> {
    std::env::var(variable)
        .ok()
        .and_then(|raw| serde_json::from_str::<Vec<Vec<String>>>(&raw).ok())
        .unwrap_or_default()
        .into_iter()
        .map(|paths| paths.into_iter().map(PathBuf::from).collect())
        .collect()
}

#[cfg(feature = "e2e")]
fn parse_single_path_queue(variable: &str) -> VecDeque<PathBuf> {
    std::env::var(variable)
        .ok()
        .and_then(|raw| serde_json::from_str::<Vec<String>>(&raw).ok())
        .unwrap_or_default()
        .into_iter()
        .map(PathBuf::from)
        .collect()
}

#[tauri::command]
pub async fn pick_input_files(
    app: AppHandle,
    state: State<'_, DesktopState>,
    request: PickInputFilesRequest,
) -> Result<Vec<OpenedFile>, String> {
    validate_pick_request(&request)?;
    let mut paths = take_test_input_paths(&state)?.unwrap_or_else(|| {
        let extensions = match request.role {
            crate::model::FileRole::Reference => REFERENCE_EXTENSIONS,
            crate::model::FileRole::Ring => RING_EXTENSIONS,
        };
        let dialog = app
            .dialog()
            .file()
            .set_title("Choose genome input")
            .add_filter("Supported genome files", extensions)
            .add_filter("All files", &["*"]);
        if request.multiple {
            dialog
                .blocking_pick_files()
                .unwrap_or_default()
                .into_iter()
                .filter_map(|path| path.into_path().ok())
                .collect()
        } else {
            dialog
                .blocking_pick_file()
                .and_then(|path| path.into_path().ok())
                .into_iter()
                .collect()
        }
    });
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    if !request.multiple {
        paths.truncate(1);
    }
    if paths.len() > MAX_PROJECT_FILES {
        return Err(format!(
            "No more than {MAX_PROJECT_FILES} inputs can be selected at once"
        ));
    }
    let mut total = 0_u64;
    for path in &paths {
        let metadata = fs::metadata(path).map_err(context("Selected input is unavailable"))?;
        if !metadata.is_file() {
            return Err("A selected input is not a regular file".to_owned());
        }
        total = total
            .checked_add(metadata.len())
            .ok_or_else(|| "Selected input size overflow".to_owned())?;
        if total > MAX_TOTAL_INPUT_BYTES {
            return Err("Selected inputs exceed the 2 GiB desktop limit".to_owned());
        }
    }

    let mut store = lock(&state.store, "project store")?;
    paths
        .into_iter()
        .map(|path| store.register_input(path, request.role, request.ring_id.clone()))
        .collect()
}

#[tauri::command]
pub async fn read_input_file(
    state: State<'_, DesktopState>,
    token: String,
) -> Result<Response, String> {
    let bytes = lock(&state.store, "project store")?.read_registered(&token)?;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn start_new_project(state: State<'_, DesktopState>) -> Result<(), String> {
    lock(&state.store, "project store")?.start_new_project();
    state.dirty.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn save_project(
    app: AppHandle,
    state: State<'_, DesktopState>,
    request: SaveProjectRequest,
) -> Result<SaveResult, String> {
    let current = lock(&state.store, "project store")?.current_project_path();
    let destination = if !request.save_as && current.is_some() {
        current
    } else {
        choose_project_destination(&app, &state)?
    };
    let Some(destination) = destination else {
        return Ok(SaveResult {
            cancelled: true,
            display_name: None,
        });
    };
    let destination = ensure_extension(destination, "brigx");
    lock(&state.store, "project store")?.save_project(request, &destination, true)?;
    state.dirty.store(false, Ordering::SeqCst);
    rebuild_application_menu(&app)?;
    Ok(SaveResult {
        cancelled: false,
        display_name: Some(display_filename(&destination)?),
    })
}

#[tauri::command]
pub async fn open_project(
    app: AppHandle,
    state: State<'_, DesktopState>,
) -> Result<OpenProjectResult, String> {
    let Some(path) = choose_open_project(&app, &state)? else {
        return Ok(OpenProjectResult::cancelled());
    };
    let result = lock(&state.store, "project store")?.open_project(&path)?;
    state.dirty.store(false, Ordering::SeqCst);
    rebuild_application_menu(&app)?;
    Ok(result)
}

#[tauri::command]
pub async fn open_recent_project(
    app: AppHandle,
    state: State<'_, DesktopState>,
    id: String,
) -> Result<OpenProjectResult, String> {
    let path = lock(&state.store, "project store")?
        .resolve_recent_project(&id)?
        .ok_or_else(|| "That recent project is no longer available".to_owned())?;
    let result = lock(&state.store, "project store")?.open_project(&path)?;
    state.dirty.store(false, Ordering::SeqCst);
    rebuild_application_menu(&app)?;
    Ok(result)
}

#[tauri::command]
pub async fn list_recent_projects(
    state: State<'_, DesktopState>,
) -> Result<Vec<RecentProject>, String> {
    lock(&state.store, "project store")?.list_recent_projects()
}

#[tauri::command]
pub async fn save_recovery_snapshot(
    state: State<'_, DesktopState>,
    request: SaveProjectRequest,
) -> Result<(), String> {
    let mut store = lock(&state.store, "project store")?;
    let recovery = store.recovery_path();
    store.save_project(request, &recovery, false)
}

#[tauri::command]
pub async fn has_recovery_snapshot(state: State<'_, DesktopState>) -> Result<bool, String> {
    let path = lock(&state.store, "project store")?.recovery_path();
    Ok(fs::metadata(path).is_ok_and(|metadata| metadata.is_file()))
}

#[tauri::command]
pub async fn open_recovery_snapshot(
    state: State<'_, DesktopState>,
) -> Result<OpenProjectResult, String> {
    let mut store = lock(&state.store, "project store")?;
    let recovery = store.recovery_path();
    let result = store.open_project(&recovery)?;
    state.dirty.store(true, Ordering::SeqCst);
    Ok(result)
}

#[tauri::command]
pub async fn clear_recovery_snapshot(state: State<'_, DesktopState>) -> Result<(), String> {
    let path = lock(&state.store, "project store")?.recovery_path();
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not clear the recovery snapshot: {error}")),
    }
}

#[tauri::command]
pub async fn choose_export_destination(
    app: AppHandle,
    state: State<'_, DesktopState>,
    default_name: String,
    mime_type: String,
    size: u64,
) -> Result<PendingExportResult, String> {
    if size > MAX_EXPORT_BYTES {
        return Err("Export exceeds the 1 GiB desktop limit".to_owned());
    }
    if mime_type.is_empty() || mime_type.len() > 255 {
        return Err("Export MIME type is invalid".to_owned());
    }
    let default_name = sanitise_filename(&default_name)?;
    let Some(destination) =
        choose_save_path(&app, &state, "Save BRIGX Export", &default_name, None)?
    else {
        return Ok(PendingExportResult {
            cancelled: true,
            display_name: None,
            token: None,
        });
    };
    let display_name = display_filename(&destination)?;
    let token = Uuid::new_v4().to_string();
    let mut pending = lock(&state.pending_exports, "export registry")?;
    pending.clear();
    pending.insert(
        token.clone(),
        PendingExport {
            destination,
            expected_size: size,
        },
    );
    Ok(PendingExportResult {
        cancelled: false,
        display_name: Some(display_name),
        token: Some(token),
    })
}

#[tauri::command]
pub async fn write_export(
    state: State<'_, DesktopState>,
    request: Request<'_>,
) -> Result<(), String> {
    let token = request
        .headers()
        .get("x-brigx-export-token")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "Missing export token".to_owned())?;
    Uuid::parse_str(token).map_err(|_| "Invalid export token".to_owned())?;
    let export = lock(&state.pending_exports, "export registry")?
        .remove(token)
        .ok_or_else(|| "Export token has expired or was already used".to_owned())?;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        _ => return Err("Export payload must be raw bytes".to_owned()),
    };
    if bytes.len() as u64 != export.expected_size || bytes.len() as u64 > MAX_EXPORT_BYTES {
        return Err("Export payload size does not match the approved save request".to_owned());
    }
    write_bytes_atomically(&export.destination, bytes)
}

#[tauri::command]
pub async fn set_dirty_state(state: State<'_, DesktopState>, dirty: bool) -> Result<(), String> {
    state.dirty.store(dirty, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn close_after_save(
    window: WebviewWindow,
    state: State<'_, DesktopState>,
) -> Result<(), String> {
    state.dirty.store(false, Ordering::SeqCst);
    state.allow_close.store(true, Ordering::SeqCst);
    window
        .close()
        .map_err(context("Could not close the BRIGX window"))
}

#[tauri::command]
pub async fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if url.is_empty() || url.len() > MAX_EXTERNAL_URL_BYTES || url.chars().any(char::is_control) {
        return Err("External URL is invalid".to_owned());
    }
    let parsed = Url::parse(&url).map_err(|_| "External URL is invalid".to_owned())?;
    let allowed = match parsed.scheme() {
        "https" => parsed.host_str().is_some(),
        "mailto" => !parsed.path().is_empty(),
        _ => false,
    };
    if !allowed {
        return Err("Only HTTPS and mailto links may be opened externally".to_owned());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(context("Could not open the external link"))
}

fn validate_pick_request(request: &PickInputFilesRequest) -> Result<(), String> {
    match request.role {
        crate::model::FileRole::Reference if request.ring_id.is_some() => {
            Err("Reference inputs cannot have a ring identifier".to_owned())
        }
        crate::model::FileRole::Ring if request.ring_id.as_deref().is_none_or(str::is_empty) => {
            Err("Ring inputs require a ring identifier".to_owned())
        }
        crate::model::FileRole::Reference if request.multiple => {
            Err("Only one reference input may be selected".to_owned())
        }
        _ => Ok(()),
    }
}

fn choose_project_destination(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
) -> Result<Option<PathBuf>, String> {
    choose_save_path(
        app,
        state,
        "Save BRIGX Project",
        "BRIGX-project.brigx",
        Some(("BRIGX Project", PROJECT_EXTENSIONS)),
    )
}

fn choose_open_project(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
) -> Result<Option<PathBuf>, String> {
    if let Some(path) = take_test_open_path(state)? {
        return Ok(Some(path));
    }
    Ok(app
        .dialog()
        .file()
        .set_title("Open BRIGX Project")
        .add_filter("BRIGX Project", PROJECT_EXTENSIONS)
        .blocking_pick_file()
        .and_then(|path| path.into_path().ok()))
}

fn choose_save_path(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    title: &str,
    default_name: &str,
    filter: Option<(&str, &[&str])>,
) -> Result<Option<PathBuf>, String> {
    if let Some(path) = take_test_save_path(state)? {
        return Ok(Some(path));
    }
    let mut dialog = app
        .dialog()
        .file()
        .set_title(title)
        .set_file_name(default_name);
    if let Some((label, extensions)) = filter {
        dialog = dialog.add_filter(label, extensions);
    }
    Ok(dialog
        .blocking_save_file()
        .and_then(|path| path.into_path().ok()))
}

#[cfg(feature = "e2e")]
fn take_test_input_paths(state: &State<'_, DesktopState>) -> Result<Option<Vec<PathBuf>>, String> {
    Ok(lock(&state.test_dialogs, "test dialog queue")?
        .input_paths
        .pop_front())
}

#[cfg(not(feature = "e2e"))]
fn take_test_input_paths(_state: &State<'_, DesktopState>) -> Result<Option<Vec<PathBuf>>, String> {
    Ok(None)
}

#[cfg(feature = "e2e")]
fn take_test_open_path(state: &State<'_, DesktopState>) -> Result<Option<PathBuf>, String> {
    Ok(lock(&state.test_dialogs, "test dialog queue")?
        .open_paths
        .pop_front())
}

#[cfg(not(feature = "e2e"))]
fn take_test_open_path(_state: &State<'_, DesktopState>) -> Result<Option<PathBuf>, String> {
    Ok(None)
}

#[cfg(feature = "e2e")]
fn take_test_save_path(state: &State<'_, DesktopState>) -> Result<Option<PathBuf>, String> {
    Ok(lock(&state.test_dialogs, "test dialog queue")?
        .save_paths
        .pop_front())
}

#[cfg(not(feature = "e2e"))]
fn take_test_save_path(_state: &State<'_, DesktopState>) -> Result<Option<PathBuf>, String> {
    Ok(None)
}

fn ensure_extension(path: PathBuf, extension: &str) -> PathBuf {
    if path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
    {
        path
    } else {
        PathBuf::from(format!("{}.{}", path.to_string_lossy(), extension))
    }
}

fn sanitise_filename(value: &str) -> Result<String, String> {
    let basename = Path::new(value)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let sanitised: String = basename
        .chars()
        .map(|character| {
            if character.is_control()
                || matches!(
                    character,
                    '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
                )
            {
                '_'
            } else {
                character
            }
        })
        .collect();
    let sanitised = sanitised.trim().trim_matches('.');
    if sanitised.is_empty() || sanitised.len() > MAX_FILENAME_BYTES {
        Err("Export filename is invalid".to_owned())
    } else {
        Ok(sanitised.to_owned())
    }
}

fn display_filename(path: &Path) -> Result<String, String> {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .ok_or_else(|| "Destination filename is not valid Unicode".to_owned())
}

fn lock<'a, T>(mutex: &'a Mutex<T>, name: &str) -> Result<MutexGuard<'a, T>, String> {
    mutex
        .lock()
        .map_err(|_| format!("Internal {name} lock is unavailable"))
}

fn context<E: std::fmt::Display>(message: &'static str) -> impl FnOnce(E) -> String {
    move |error| format!("{message}: {error}")
}
