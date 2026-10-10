mod allowlist;
mod game_fs;
pub mod path_guard;
mod scanner;
mod sidecar;
mod storage;
mod system;

pub use allowlist::{PluginCommandAllowlist, validate_command_name};
pub use sidecar::plugin_sidecar_bin_dir;
pub use game_fs::{
    plugin_game_fs_backup, plugin_game_fs_delete, plugin_game_fs_exists, plugin_game_fs_read,
    plugin_game_fs_restore, plugin_game_fs_write,
};
pub use scanner::{ScannedExecutable, plugin_game_find_files, plugin_game_scan_executables};
pub use storage::{
    plugin_storage_delete, plugin_storage_get, plugin_storage_list_keys, plugin_storage_set,
};
pub use system::{CommandOutput, plugin_register_commands, plugin_system_run};
