use crate::model::{
    FileBinding, FileRole, OpenProjectResult, OpenedFile, PROJECT_SCHEMA_VERSION, PROJECT_TYPE,
    PathKind, PersistedProjectFile, ProjectManifest, RecentProject, RecentProjectRecord,
    SaveProjectRequest,
};
use crate::validation::{is_brigx_session, is_circular_plot_data};
use atomic_write_file::OpenOptions;
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fmt::Write as FmtWrite;
use std::fs::{self, File, Metadata};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use uuid::Uuid;

pub const MAX_PROJECT_BYTES: u64 = 64 * 1024 * 1024;
pub const MAX_INPUT_BYTES: u64 = 512 * 1024 * 1024;
pub const MAX_TOTAL_INPUT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
pub const MAX_PROJECT_FILES: usize = 1_000;
pub const MAX_EXPORT_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_RECENT_PROJECTS: usize = 10;
const MAX_STRING_BYTES: usize = 32 * 1024;

#[derive(Clone, Debug)]
struct RegisteredFile {
    path: PathBuf,
    signature: String,
    sha256: Option<String>,
}

#[derive(Debug)]
pub struct ProjectStore {
    app_version: String,
    user_data_directory: PathBuf,
    token_registry: HashMap<String, RegisteredFile>,
    current_project_path: Option<PathBuf>,
}

impl ProjectStore {
    pub fn new(app_version: String, user_data_directory: PathBuf) -> Self {
        Self {
            app_version,
            user_data_directory,
            token_registry: HashMap::new(),
            current_project_path: None,
        }
    }

    pub fn recovery_path(&self) -> PathBuf {
        self.user_data_directory.join("recovery.brigx")
    }

    pub fn current_project_path(&self) -> Option<PathBuf> {
        self.current_project_path.clone()
    }

    pub fn start_new_project(&mut self) {
        self.current_project_path = None;
    }

    pub fn register_input(
        &mut self,
        path: PathBuf,
        role: FileRole,
        ring_id: Option<String>,
    ) -> Result<OpenedFile, String> {
        validate_role(role, ring_id.as_deref())?;
        let metadata = file_metadata(&path)?;
        if metadata.len() > MAX_INPUT_BYTES {
            return Err(format!(
                "{} exceeds {}",
                display_filename(&path)?,
                format_bytes(MAX_INPUT_BYTES)
            ));
        }
        let last_modified = metadata_modified_millis(&metadata)?;
        let signature = file_signature(metadata.len(), last_modified);
        let token = self.register_path(path.clone(), signature, None);
        Ok(OpenedFile {
            role,
            ring_id,
            token,
            name: display_filename(&path)?,
            mime_type: mime_guess::from_path(&path)
                .first_or_octet_stream()
                .essence_str()
                .to_owned(),
            size: metadata.len(),
            last_modified,
        })
    }

    pub fn read_registered(&mut self, token: &str) -> Result<Vec<u8>, String> {
        validate_uuid(token, "file token")?;
        let registered = self
            .token_registry
            .get(token)
            .cloned()
            .ok_or_else(|| "The selected file is no longer registered".to_owned())?;
        let metadata = file_metadata(&registered.path)?;
        if metadata.len() > MAX_INPUT_BYTES {
            return Err(format!("Input exceeds {}", format_bytes(MAX_INPUT_BYTES)));
        }
        let bytes =
            fs::read(&registered.path).map_err(context("Could not read the selected file"))?;
        if bytes.len() as u64 != metadata.len() {
            return Err("The selected file changed while it was being read".to_owned());
        }
        if let Some(expected) = &registered.sha256
            && sha256_bytes(&bytes) != *expected
        {
            return Err("SHA-256 no longer matches".to_owned());
        }
        let modified = metadata_modified_millis(&metadata)?;
        if let Some(current) = self.token_registry.get_mut(token) {
            current.signature = file_signature(metadata.len(), modified);
        }
        Ok(bytes)
    }

    pub fn save_project(
        &mut self,
        request: SaveProjectRequest,
        destination: &Path,
        include_hashes: bool,
    ) -> Result<(), String> {
        let manifest = self.create_manifest(request, destination, include_hashes)?;
        write_json_atomically(destination, &manifest, Some(MAX_PROJECT_BYTES))?;
        if destination != self.recovery_path() {
            self.current_project_path = Some(destination.to_path_buf());
            self.remember_recent_project(destination)?;
        }
        Ok(())
    }

    pub fn open_project(&mut self, project_path: &Path) -> Result<OpenProjectResult, String> {
        let manifest = read_manifest(project_path)?;
        let mut issues = Vec::new();
        let mut files = Vec::new();
        let mut total_bytes = 0_u64;

        for entry in &manifest.files {
            let resolved = resolve_persisted_path(project_path, entry);
            let opened = (|| -> Result<OpenedFile, String> {
                let metadata = file_metadata(&resolved)?;
                if metadata.len() > MAX_INPUT_BYTES {
                    return Err(format!(
                        "larger than the {} desktop limit",
                        format_bytes(MAX_INPUT_BYTES)
                    ));
                }
                total_bytes = total_bytes
                    .checked_add(metadata.len())
                    .ok_or_else(|| "project input size overflow".to_owned())?;
                if total_bytes > MAX_TOTAL_INPUT_BYTES {
                    return Err(format!(
                        "project inputs exceed {}",
                        format_bytes(MAX_TOTAL_INPUT_BYTES)
                    ));
                }
                if metadata.len() != entry.size {
                    return Err(format!(
                        "size changed from {} to {} bytes",
                        entry.size,
                        metadata.len()
                    ));
                }
                let last_modified = metadata_modified_millis(&metadata)?;
                let signature = file_signature(metadata.len(), last_modified);
                if let Some(expected) = &entry.sha256 {
                    let actual = sha256_file(&resolved)?;
                    if actual != *expected {
                        return Err("SHA-256 no longer matches".to_owned());
                    }
                }
                let token = self.register_path(resolved.clone(), signature, entry.sha256.clone());
                Ok(OpenedFile {
                    role: entry.role,
                    ring_id: entry.ring_id.clone(),
                    token,
                    name: entry.name.clone(),
                    mime_type: entry.mime_type.clone(),
                    size: metadata.len(),
                    last_modified,
                })
            })();
            match opened {
                Ok(file) => files.push(file),
                Err(reason) => issues.push(format!("{}: {reason}", entry.name)),
            }
        }

        let is_recovery = project_path == self.recovery_path();
        self.current_project_path = (!is_recovery).then(|| project_path.to_path_buf());
        if !is_recovery {
            self.remember_recent_project(project_path)?;
        }

        Ok(OpenProjectResult {
            cancelled: false,
            display_name: Some(display_filename(project_path)?),
            session_json: Some(
                serde_json::to_string(&manifest.session)
                    .map_err(context("Could not serialise the project session"))?,
            ),
            plot_json: manifest
                .plot
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .map_err(context("Could not serialise the project plot"))?,
            files,
            issues,
        })
    }

    pub fn list_recent_projects(&mut self) -> Result<Vec<RecentProject>, String> {
        let records = self.read_recent_records();
        let existing: Vec<_> = records
            .iter()
            .filter(|record| file_metadata(Path::new(&record.file_path)).is_ok())
            .cloned()
            .collect();
        if existing.len() != records.len() {
            self.write_recent_records(&existing)?;
        }
        Ok(existing
            .into_iter()
            .map(|record| RecentProject {
                id: record.id,
                display_name: record.display_name,
                last_opened: record.last_opened,
            })
            .collect())
    }

    pub fn resolve_recent_project(&self, id: &str) -> Result<Option<PathBuf>, String> {
        validate_recent_id(id)?;
        Ok(self
            .read_recent_records()
            .into_iter()
            .find(|record| record.id == id)
            .map(|record| PathBuf::from(record.file_path)))
    }

    fn create_manifest(
        &mut self,
        request: SaveProjectRequest,
        destination: &Path,
        include_hashes: bool,
    ) -> Result<ProjectManifest, String> {
        if request.session_json.len() as u64 > MAX_PROJECT_BYTES {
            return Err("Session data is too large to save safely".to_owned());
        }
        if request
            .plot_json
            .as_ref()
            .is_some_and(|plot| plot.len() as u64 > MAX_PROJECT_BYTES)
        {
            return Err("Plot data is too large to save safely".to_owned());
        }
        if request.files.len() > MAX_PROJECT_FILES {
            return Err(format!(
                "Project contains more than {MAX_PROJECT_FILES} input files"
            ));
        }

        let session: Value = serde_json::from_str(&request.session_json)
            .map_err(|_| "Project session is not valid JSON".to_owned())?;
        if !is_brigx_session(&session) {
            return Err("Project session is invalid".to_owned());
        }
        let plot = request
            .plot_json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()
            .map_err(|_| "Project plot is not valid JSON".to_owned())?;
        if plot
            .as_ref()
            .is_some_and(|value| !is_circular_plot_data(value))
        {
            return Err("Project plot is invalid".to_owned());
        }

        let mut files = Vec::with_capacity(request.files.len());
        let mut total_input_bytes = 0_u64;
        for binding in request.files {
            validate_binding(&binding)?;
            let registered = self
                .token_registry
                .get(&binding.token)
                .cloned()
                .ok_or_else(|| format!("{} is no longer registered", binding.name))?;
            let metadata = file_metadata(&registered.path)?;
            if metadata.len() > MAX_INPUT_BYTES {
                return Err(format!(
                    "{} exceeds {}",
                    binding.name,
                    format_bytes(MAX_INPUT_BYTES)
                ));
            }
            total_input_bytes = total_input_bytes
                .checked_add(metadata.len())
                .ok_or_else(|| "Project input size overflow".to_owned())?;
            if total_input_bytes > MAX_TOTAL_INPUT_BYTES {
                return Err(format!(
                    "Project inputs exceed {}",
                    format_bytes(MAX_TOTAL_INPUT_BYTES)
                ));
            }

            let modified = metadata_modified_millis(&metadata)?;
            let signature = file_signature(metadata.len(), modified);
            let cached_hash = (registered.signature == signature)
                .then(|| registered.sha256.clone())
                .flatten();
            let hash = if include_hashes {
                Some(self.hash_registered_file(&registered.path, &signature, cached_hash)?)
            } else {
                cached_hash
            };
            if let Some(current) = self.token_registry.get_mut(&binding.token) {
                current.signature.clone_from(&signature);
                current.sha256.clone_from(&hash);
            }

            let (path_kind, stored_path) = persist_path(destination, &registered.path)?;
            files.push(PersistedProjectFile {
                role: binding.role,
                ring_id: binding.ring_id,
                path_kind,
                path: stored_path,
                name: display_filename(&registered.path)?,
                mime_type: if binding.mime_type.len() <= 255 {
                    binding.mime_type
                } else {
                    String::new()
                },
                size: metadata.len(),
                last_modified: modified,
                sha256: hash,
            });
        }

        Ok(ProjectManifest {
            project_type: PROJECT_TYPE.to_owned(),
            schema_version: PROJECT_SCHEMA_VERSION,
            app_version: self.app_version.clone(),
            saved_at: OffsetDateTime::now_utc()
                .format(&Rfc3339)
                .map_err(context("Could not format the project timestamp"))?,
            session,
            plot,
            files,
        })
    }

    fn hash_registered_file(
        &mut self,
        path: &Path,
        signature: &str,
        existing_hash: Option<String>,
    ) -> Result<String, String> {
        if let Some(hash) = existing_hash {
            return Ok(hash);
        }
        if let Some(hash) = self
            .token_registry
            .values()
            .find(|entry| entry.path == path && entry.signature == signature)
            .and_then(|entry| entry.sha256.clone())
        {
            return Ok(hash);
        }
        let hash = sha256_file(path)?;
        for entry in self.token_registry.values_mut() {
            if entry.path == path && entry.signature == signature {
                entry.sha256 = Some(hash.clone());
            }
        }
        Ok(hash)
    }

    fn register_path(
        &mut self,
        path: PathBuf,
        signature: String,
        sha256: Option<String>,
    ) -> String {
        let token = Uuid::new_v4().to_string();
        self.token_registry.insert(
            token.clone(),
            RegisteredFile {
                path,
                signature,
                sha256,
            },
        );
        token
    }

    fn recent_projects_path(&self) -> PathBuf {
        self.user_data_directory.join("recent-projects.json")
    }

    fn remember_recent_project(&mut self, path: &Path) -> Result<(), String> {
        let path_string = path_to_string(path)?;
        let id = sha256_bytes(path_string.as_bytes())[..24].to_owned();
        let mut records: Vec<_> = self
            .read_recent_records()
            .into_iter()
            .filter(|record| record.id != id)
            .collect();
        records.insert(
            0,
            RecentProjectRecord {
                id,
                file_path: path_string,
                display_name: display_filename(path)?,
                last_opened: now_millis()?,
            },
        );
        records.truncate(MAX_RECENT_PROJECTS);
        self.write_recent_records(&records)
    }

    fn read_recent_records(&self) -> Vec<RecentProjectRecord> {
        let path = self.recent_projects_path();
        let Ok(metadata) = fs::metadata(&path) else {
            return Vec::new();
        };
        if metadata.len() > 1024 * 1024 {
            return Vec::new();
        }
        let Ok(bytes) = fs::read(path) else {
            return Vec::new();
        };
        let Ok(records) = serde_json::from_slice::<Vec<RecentProjectRecord>>(&bytes) else {
            return Vec::new();
        };
        records
            .into_iter()
            .filter(is_valid_recent_record)
            .take(MAX_RECENT_PROJECTS)
            .collect()
    }

    fn write_recent_records(&self, records: &[RecentProjectRecord]) -> Result<(), String> {
        write_json_atomically(&self.recent_projects_path(), records, Some(1024 * 1024))
    }
}

pub fn parse_project_manifest(value: Value) -> Result<ProjectManifest, String> {
    let Some(object) = value.as_object() else {
        return Err("Project must be a JSON object".to_owned());
    };
    if object.get("type").and_then(Value::as_str) != Some(PROJECT_TYPE) {
        return Err("Not a BRIGX project file".to_owned());
    }
    let schema_version = object.get("schemaVersion").and_then(Value::as_u64);
    if schema_version != Some(u64::from(PROJECT_SCHEMA_VERSION)) {
        return Err(format!(
            "Unsupported BRIGX project schema: {}",
            schema_version
                .map(|version| version.to_string())
                .unwrap_or_else(|| "missing".to_owned())
        ));
    }
    let manifest: ProjectManifest =
        serde_json::from_value(value).map_err(|_| "Project metadata is incomplete".to_owned())?;
    if manifest.app_version.is_empty() || manifest.saved_at.is_empty() {
        return Err("Project metadata is incomplete".to_owned());
    }
    if manifest.files.len() > MAX_PROJECT_FILES {
        return Err("Project contains too many input files".to_owned());
    }
    if !manifest.files.iter().all(is_valid_persisted_file) {
        return Err("Project file references are invalid".to_owned());
    }
    if !is_brigx_session(&manifest.session) {
        return Err("Project session is invalid".to_owned());
    }
    if manifest
        .plot
        .as_ref()
        .is_some_and(|plot| !is_circular_plot_data(plot))
    {
        return Err("Project plot is invalid".to_owned());
    }
    Ok(manifest)
}

pub fn write_bytes_atomically(destination: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(context("Could not create the destination folder"))?;
    }
    let mut options = OpenOptions::new();
    #[cfg(unix)]
    {
        use atomic_write_file::unix::OpenOptionsExt as AtomicOpenOptionsExt;
        use std::os::unix::fs::OpenOptionsExt as StandardOpenOptionsExt;
        options.preserve_mode(false).mode(0o600);
    }
    let mut file = options
        .open(destination)
        .map_err(context("Could not create the destination file"))?;
    file.write_all(bytes)
        .map_err(context("Could not write the destination file"))?;
    file.commit()
        .map_err(context("Could not commit the destination file"))
}

fn read_manifest(path: &Path) -> Result<ProjectManifest, String> {
    let metadata = file_metadata(path)?;
    if metadata.len() > MAX_PROJECT_BYTES {
        return Err("Project file is too large".to_owned());
    }
    let bytes = fs::read(path).map_err(context("Could not read the project file"))?;
    let value =
        serde_json::from_slice(&bytes).map_err(|_| "Project is not valid JSON".to_owned())?;
    parse_project_manifest(value)
}

fn write_json_atomically<T: Serialize + ?Sized>(
    destination: &Path,
    value: &T,
    maximum_bytes: Option<u64>,
) -> Result<(), String> {
    let mut serialised =
        serde_json::to_vec_pretty(value).map_err(context("Could not serialise JSON data"))?;
    serialised.push(b'\n');
    if maximum_bytes.is_some_and(|maximum| serialised.len() as u64 > maximum) {
        return Err(format!(
            "Project data exceeds {}",
            format_bytes(maximum_bytes.unwrap_or_default())
        ));
    }
    write_bytes_atomically(destination, &serialised)
}

fn persist_path(project_path: &Path, source_path: &Path) -> Result<(PathKind, String), String> {
    if let Some(project_directory) = project_path.parent()
        && let Ok(relative) = source_path.strip_prefix(project_directory)
        && !relative.as_os_str().is_empty()
    {
        return Ok((PathKind::Relative, path_to_string(relative)?));
    }
    Ok((PathKind::Absolute, path_to_string(source_path)?))
}

fn resolve_persisted_path(project_path: &Path, entry: &PersistedProjectFile) -> PathBuf {
    match entry.path_kind {
        PathKind::Relative => project_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(&entry.path),
        PathKind::Absolute => PathBuf::from(&entry.path),
    }
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(context("Could not open input for hashing"))?;
    let mut reader = BufReader::new(file);
    let mut hash = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(context("Could not hash the input file"))?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    Ok(hex_digest(hash.finalize()))
}

fn sha256_bytes(bytes: &[u8]) -> String {
    hex_digest(Sha256::digest(bytes))
}

fn hex_digest(bytes: impl AsRef<[u8]>) -> String {
    let bytes = bytes.as_ref();
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        write!(&mut output, "{byte:02x}").expect("writing to a String cannot fail");
    }
    output
}

fn file_metadata(path: &Path) -> Result<Metadata, String> {
    let metadata = fs::metadata(path).map_err(context("File is unavailable"))?;
    if !metadata.is_file() {
        return Err("Path is not a regular file".to_owned());
    }
    Ok(metadata)
}

fn metadata_modified_millis(metadata: &Metadata) -> Result<f64, String> {
    let modified = metadata
        .modified()
        .map_err(context("Could not read the file modification time"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "File modification time is before the Unix epoch".to_owned())?;
    Ok(modified.as_secs_f64() * 1_000.0)
}

fn file_signature(size: u64, modified: f64) -> String {
    format!("{size}:{:.0}", modified.round())
}

fn now_millis() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "System clock is before the Unix epoch".to_owned())?
        .as_millis()
        .try_into()
        .map_err(|_| "System clock value is too large".to_owned())
}

fn path_to_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(str::to_owned)
        .ok_or_else(|| "BRIGX cannot store a path that is not valid Unicode".to_owned())
}

fn display_filename(path: &Path) -> Result<String, String> {
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "File name is missing or not valid Unicode".to_owned())?;
    if filename.len() > MAX_STRING_BYTES {
        return Err("File name is too long".to_owned());
    }
    Ok(filename.to_owned())
}

fn validate_binding(binding: &FileBinding) -> Result<(), String> {
    validate_role(binding.role, binding.ring_id.as_deref())?;
    validate_uuid(&binding.token, "file token")?;
    if binding.name.is_empty() || binding.name.len() > MAX_STRING_BYTES {
        return Err("Project file name is invalid".to_owned());
    }
    if !binding.last_modified.is_finite() || binding.last_modified < 0.0 {
        return Err(format!("{} has invalid file metadata", binding.name));
    }
    if binding.size > MAX_INPUT_BYTES {
        return Err(format!("{} exceeds the desktop file limit", binding.name));
    }
    Ok(())
}

fn validate_role(role: FileRole, ring_id: Option<&str>) -> Result<(), String> {
    match role {
        FileRole::Reference if ring_id.is_some() => {
            Err("Reference inputs cannot have a ring identifier".to_owned())
        }
        FileRole::Ring if ring_id.is_none_or(str::is_empty) => {
            Err("Ring inputs require a ring identifier".to_owned())
        }
        _ => Ok(()),
    }
}

fn validate_uuid(value: &str, label: &str) -> Result<(), String> {
    Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| format!("Invalid {label}"))
}

fn validate_recent_id(value: &str) -> Result<(), String> {
    if value.len() == 24 && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err("Invalid recent-project identifier".to_owned())
    }
}

fn is_valid_recent_record(record: &RecentProjectRecord) -> bool {
    validate_recent_id(&record.id).is_ok()
        && !record.display_name.is_empty()
        && record.display_name.len() <= MAX_STRING_BYTES
        && Path::new(&record.file_path).is_absolute()
}

fn is_valid_persisted_file(file: &PersistedProjectFile) -> bool {
    let path = Path::new(&file.path);
    let path_kind_valid = match file.path_kind {
        PathKind::Absolute => path.is_absolute(),
        PathKind::Relative => !path.is_absolute(),
    };
    path_kind_valid
        && !file.path.is_empty()
        && file.path.len() <= MAX_STRING_BYTES
        && !file.name.is_empty()
        && file.name.len() <= MAX_STRING_BYTES
        && file.mime_type.len() <= 255
        && file.last_modified.is_finite()
        && file.last_modified >= 0.0
        && file.size <= MAX_INPUT_BYTES
        && file.sha256.as_ref().is_none_or(|hash| {
            hash.len() == 64
                && hash
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        })
}

fn format_bytes(bytes: u64) -> String {
    format!("{} MiB", bytes.div_ceil(1024 * 1024))
}

fn context<E: std::fmt::Display>(message: &'static str) -> impl FnOnce(E) -> String {
    move |error| format!("{message}: {error}")
}

#[cfg(test)]
mod tests {
    use super::{ProjectStore, parse_project_manifest};
    use crate::model::{FileBinding, FileRole, SaveProjectRequest};
    use serde_json::{Value, json};
    use sha2::{Digest, Sha256};
    use std::fs;
    use std::time::{Duration, SystemTime};
    use tempfile::TempDir;

    fn valid_session() -> Value {
        json!({
            "version": "test",
            "timestamp": 0,
            "referenceFileName": "reference.fa",
            "referenceAnnotations": [],
            "rings": [],
            "params": {
                "minIdentity": 70,
                "minAlignmentLength": 1000,
                "colorScheme": "blue-red",
                "forceAlignment": false,
                "alignerOptions": ""
            },
            "imageConfig": {
                "innerRadius": 200,
                "ringWidth": 20,
                "gcRingWidth": 40,
                "ringSpacing": 4,
                "legendFontSize": 16,
                "scaleFontSize": 12,
                "titleFontSize": 24,
                "labelFontSize": 14,
                "title": ""
            }
        })
    }

    fn valid_plot() -> Value {
        json!({
            "reference": { "name": "reference", "length": 8 },
            "rings": [],
            "config": { "minIdentity": 70, "minAlignmentLength": 1000 }
        })
    }

    fn fixture() -> (
        TempDir,
        ProjectStore,
        std::path::PathBuf,
        SaveProjectRequest,
    ) {
        let directory = TempDir::new().expect("temporary directory");
        let source = directory.path().join("reference.fa");
        fs::write(&source, ">reference\nACGTACGT\n").expect("write source");
        let mut store = ProjectStore::new("0.0.0-test".into(), directory.path().into());
        let opened = store
            .register_input(source, FileRole::Reference, None)
            .expect("register input");
        let request = SaveProjectRequest {
            session_json: valid_session().to_string(),
            plot_json: Some(valid_plot().to_string()),
            files: vec![FileBinding {
                role: FileRole::Reference,
                ring_id: None,
                token: opened.token,
                name: opened.name,
                mime_type: opened.mime_type,
                size: opened.size,
                last_modified: opened.last_modified,
            }],
            save_as: false,
        };
        let project = directory.path().join("example.brigx");
        (directory, store, project, request)
    }

    #[test]
    fn writes_hashed_project_and_restores_registered_source() {
        let (_directory, mut store, project, request) = fixture();
        store
            .save_project(request, &project, true)
            .expect("save project");
        let manifest = parse_project_manifest(
            serde_json::from_slice(&fs::read(&project).expect("read project")).expect("parse JSON"),
        )
        .expect("valid manifest");
        assert_eq!(manifest.files[0].path, "reference.fa");
        assert_eq!(manifest.files[0].sha256.as_ref().map(String::len), Some(64));

        let opened = store.open_project(&project).expect("open project");
        assert!(opened.issues.is_empty());
        assert_eq!(opened.files.len(), 1);
        let bytes = store
            .read_registered(&opened.files[0].token)
            .expect("read registered source");
        assert_eq!(bytes, b">reference\nACGTACGT\n");
        assert_eq!(
            store.list_recent_projects().expect("recent projects")[0].display_name,
            "example.brigx"
        );
    }

    #[test]
    fn reports_changed_source_instead_of_loading_it() {
        let (directory, mut store, project, request) = fixture();
        store
            .save_project(request, &project, true)
            .expect("save project");
        fs::write(
            directory.path().join("reference.fa"),
            ">reference\nCHANGED\n",
        )
        .expect("change source");
        let opened = store.open_project(&project).expect("open project");
        assert!(opened.files.is_empty());
        assert_eq!(opened.issues.len(), 1);
        assert!(opened.issues[0].contains("reference.fa"));
    }

    #[test]
    fn rehashes_token_backed_source_after_change() {
        let (directory, mut store, project, request) = fixture();
        store
            .save_project(request.clone(), &project, true)
            .expect("save project");
        let source = directory.path().join("reference.fa");
        let replacement = b">reference\nTGCATGCA\n";
        fs::write(&source, replacement).expect("replace source");
        let future = SystemTime::now() + Duration::from_secs(2);
        let file = fs::OpenOptions::new()
            .append(true)
            .open(&source)
            .expect("open source");
        file.set_modified(future).expect("change modification time");

        let changed = directory.path().join("changed.brigx");
        store
            .save_project(request, &changed, true)
            .expect("save changed project");
        let manifest = parse_project_manifest(
            serde_json::from_slice(&fs::read(changed).expect("read changed project"))
                .expect("parse changed project"),
        )
        .expect("valid changed manifest");
        let expected = super::hex_digest(Sha256::digest(replacement));
        assert_eq!(manifest.files[0].sha256.as_deref(), Some(expected.as_str()));
    }

    #[test]
    fn clears_current_destination_for_new_project() {
        let (_directory, mut store, project, request) = fixture();
        store
            .save_project(request, &project, true)
            .expect("save project");
        assert_eq!(
            store.current_project_path().as_deref(),
            Some(project.as_path())
        );
        store.start_new_project();
        assert!(store.current_project_path().is_none());
    }

    #[test]
    fn rejects_non_project_manifests() {
        assert_eq!(
            parse_project_manifest(json!({})).unwrap_err(),
            "Not a BRIGX project file"
        );
        assert!(
            parse_project_manifest(json!({
                "type": "brigx-project",
                "schemaVersion": 99
            }))
            .unwrap_err()
            .contains("Unsupported BRIGX project schema")
        );
        assert_eq!(
            parse_project_manifest(json!({
                "type": "brigx-project",
                "schemaVersion": 1,
                "appVersion": "test",
                "savedAt": "1970-01-01T00:00:00Z",
                "session": {},
                "files": []
            }))
            .unwrap_err(),
            "Project session is invalid"
        );
    }
}
