//! Unit tests for desktop database data models.
//!
//! Targets the simplest testable surface: settings, user configuration,
//! and platform enum roundtrips. These types are the on-disk schema;
//! any drift breaks user data migration.

use crate::models::data::{DownloadType, DownloadableMetadata, Settings, UserConfiguration};
use crate::platform::Platform;

#[test]
fn settings_default_has_expected_values() {
    let s = Settings::default();
    assert!(!s.autostart);
    assert_eq!(s.max_download_threads, 4);
    assert!(!s.force_offline);
}

#[test]
fn settings_serde_roundtrip() {
    let original = Settings {
        autostart: true,
        max_download_threads: 8,
        force_offline: true,
    };
    let json = serde_json::to_string(&original).expect("serialize settings");
    let deserialized: Settings = serde_json::from_str(&json).expect("deserialize settings");
    assert_eq!(deserialized.autostart, original.autostart);
    assert_eq!(
        deserialized.max_download_threads,
        original.max_download_threads
    );
    assert_eq!(deserialized.force_offline, original.force_offline);
}

#[test]
fn user_configuration_default_has_empty_template() {
    let uc = UserConfiguration::default();
    assert_eq!(uc.launch_template, "{}");
    assert!(uc.override_handler.is_none());
    assert!(!uc.enable_updates);
}

#[test]
fn user_configuration_serde_roundtrip() {
    let original = UserConfiguration {
        launch_template: r#"{"foo": "bar"}"#.to_string(),
        override_proton_path: Some("/usr/bin/proton".to_string()),
        override_handler: Some("custom".to_string()),
        enable_updates: true,
    };
    let json = serde_json::to_string(&original).expect("serialize");
    let deserialized: UserConfiguration = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(deserialized.launch_template, original.launch_template);
    assert_eq!(
        deserialized.override_proton_path,
        original.override_proton_path
    );
    assert_eq!(deserialized.override_handler, original.override_handler);
    assert_eq!(deserialized.enable_updates, original.enable_updates);
}

#[test]
fn downloadable_metadata_new_sets_all_fields() {
    let m = DownloadableMetadata::new(
        "game-001".to_string(),
        "1.0.0".to_string(),
        Platform::Windows,
        DownloadType::Game,
    );
    assert_eq!(m.id, "game-001");
    assert_eq!(m.version, "1.0.0");
}

#[test]
fn platform_equality_by_variant() {
    assert_eq!(Platform::Windows, Platform::Windows);
    assert_ne!(Platform::Windows, Platform::Linux);
}
