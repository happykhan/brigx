use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROJECT_TYPE: &str = "brigx-project";
pub const PROJECT_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FileRole {
    Reference,
    Ring,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectRequest {
    pub session_json: String,
    pub plot_json: Option<String>,
    pub files: Vec<FileBinding>,
    #[serde(default)]
    pub save_as: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileBinding {
    pub role: FileRole,
    pub ring_id: Option<String>,
    pub token: String,
    pub name: String,
    #[serde(rename = "type")]
    pub mime_type: String,
    pub size: u64,
    pub last_modified: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickInputFilesRequest {
    pub role: FileRole,
    pub ring_id: Option<String>,
    #[serde(default)]
    pub multiple: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFile {
    pub role: FileRole,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ring_id: Option<String>,
    pub token: String,
    pub name: String,
    #[serde(rename = "type")]
    pub mime_type: String,
    pub size: u64,
    pub last_modified: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectResult {
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plot_json: Option<String>,
    pub files: Vec<OpenedFile>,
    pub issues: Vec<String>,
}

impl OpenProjectResult {
    pub fn cancelled() -> Self {
        Self {
            cancelled: true,
            display_name: None,
            session_json: None,
            plot_json: None,
            files: Vec::new(),
            issues: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PathKind {
    Absolute,
    Relative,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedProjectFile {
    pub role: FileRole,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ring_id: Option<String>,
    pub path_kind: PathKind,
    pub path: String,
    pub name: String,
    #[serde(rename = "type")]
    pub mime_type: String,
    pub size: u64,
    pub last_modified: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    #[serde(rename = "type")]
    pub project_type: String,
    pub schema_version: u32,
    pub app_version: String,
    pub saved_at: String,
    pub session: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plot: Option<Value>,
    pub files: Vec<PersistedProjectFile>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub id: String,
    pub display_name: String,
    pub last_opened: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProjectRecord {
    pub id: String,
    pub display_name: String,
    pub last_opened: u64,
    pub file_path: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingExportResult {
    pub cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}
