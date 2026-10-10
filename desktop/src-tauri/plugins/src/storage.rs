use database::{borrow_db_checked, borrow_db_mut_checked};
use serde_json::Value;

/// Maximum accepted length (in bytes) for a plugin id or storage key. Storage
/// is keyed by plugin id in the Rust-side database, so bounds keep a runaway
/// plugin from growing the database with absurd identifiers.
const MAX_IDENTIFIER_LEN: usize = 256;

fn validate_identifier(label: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{label} must not be empty"));
    }
    if value.len() > MAX_IDENTIFIER_LEN {
        return Err(format!(
            "{label} must be at most {MAX_IDENTIFIER_LEN} characters"
        ));
    }
    Ok(())
}

/// Read a value previously stored by `plugin_id` under `key`.
#[tauri::command]
pub fn plugin_storage_get(plugin_id: String, key: String) -> Result<Option<Value>, String> {
    validate_identifier("plugin_id", &plugin_id)?;
    validate_identifier("key", &key)?;

    let db = borrow_db_checked();
    Ok(db
        .plugin_storage
        .get(&plugin_id)
        .and_then(|entries| entries.get(&key))
        .cloned())
}

/// Store `value` for `plugin_id` under `key`, replacing any previous value.
#[tauri::command]
pub fn plugin_storage_set(plugin_id: String, key: String, value: Value) -> Result<(), String> {
    validate_identifier("plugin_id", &plugin_id)?;
    validate_identifier("key", &key)?;

    let mut db = borrow_db_mut_checked();
    db.plugin_storage
        .entry(plugin_id)
        .or_default()
        .insert(key, value);
    Ok(())
}

/// Remove the value stored by `plugin_id` under `key`. Missing keys are a
/// no-op.
#[tauri::command]
pub fn plugin_storage_delete(plugin_id: String, key: String) -> Result<(), String> {
    validate_identifier("plugin_id", &plugin_id)?;
    validate_identifier("key", &key)?;

    let mut db = borrow_db_mut_checked();
    if let Some(entries) = db.plugin_storage.get_mut(&plugin_id) {
        entries.remove(&key);
    }
    Ok(())
}

/// List every key `plugin_id` has stored, sorted for deterministic output.
#[tauri::command]
pub fn plugin_storage_list_keys(plugin_id: String) -> Result<Vec<String>, String> {
    validate_identifier("plugin_id", &plugin_id)?;

    let db = borrow_db_checked();
    let mut keys: Vec<String> = db
        .plugin_storage
        .get(&plugin_id)
        .map(|entries| entries.keys().cloned().collect())
        .unwrap_or_default();
    keys.sort();
    Ok(keys)
}
