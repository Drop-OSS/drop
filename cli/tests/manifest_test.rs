//! Integration tests for `downpour::manifest::DepotManifest`.
//!
//! Smoke tests: constructors, append, serde roundtrip. These exercise the
//! public API exposed via `lib.rs` and validate the fix for the binary-only
//! crate limitation (see `cli-ci.yml` comments).

use downpour::manifest::{CompressionOption, DepotManifest};

#[test]
fn test_depot_manifest_new_is_empty() {
    let manifest = DepotManifest::new();
    assert!(manifest.is_empty());
    assert_eq!(manifest.len(), 0);
}

#[test]
fn test_depot_manifest_append_adds_entry() {
    let mut manifest = DepotManifest::new();
    manifest.append(
        "game-001".to_string(),
        "v1.0".to_string(),
        CompressionOption::None,
    );
    assert!(!manifest.is_empty());
    assert_eq!(manifest.len(), 1);
}

#[test]
fn test_depot_manifest_append_multiple_distinct() {
    let mut manifest = DepotManifest::new();
    manifest.append(
        "game-001".to_string(),
        "v1.0".to_string(),
        CompressionOption::Gzip,
    );
    manifest.append(
        "game-002".to_string(),
        "v2.0".to_string(),
        CompressionOption::Zstd,
    );
    assert_eq!(manifest.len(), 2);
}

#[test]
fn test_depot_manifest_append_same_game_overwrites() {
    let mut manifest = DepotManifest::new();
    manifest.append(
        "game-001".to_string(),
        "v1.0".to_string(),
        CompressionOption::None,
    );
    manifest.append(
        "game-001".to_string(),
        "v2.0".to_string(),
        CompressionOption::Gzip,
    );
    // Same game_id overwrites — still one entry, count stays at 1.
    assert_eq!(manifest.len(), 1);
}

#[test]
fn test_depot_manifest_serde_roundtrip() {
    let mut manifest = DepotManifest::new();
    manifest.append(
        "zelda".to_string(),
        "1.0.0".to_string(),
        CompressionOption::Zstd,
    );
    manifest.append(
        "mario".to_string(),
        "2.1.3".to_string(),
        CompressionOption::None,
    );

    let json = serde_json::to_string(&manifest).expect("serialize manifest");
    assert!(!json.is_empty());

    let deserialized: DepotManifest = serde_json::from_str(&json).expect("deserialize manifest");
    assert_eq!(deserialized.len(), 2);
}

#[test]
fn test_depot_manifest_serde_variants() {
    let variants = [
        ("None", CompressionOption::None),
        ("Gzip", CompressionOption::Gzip),
        ("Zstd", CompressionOption::Zstd),
    ];

    for (name, variant) in &variants {
        let mut manifest = DepotManifest::new();
        manifest.append("game".to_string(), "v1".to_string(), *variant);

        let json = serde_json::to_string(&manifest).unwrap();
        assert!(
            json.contains(name),
            "expected '{}' in JSON for variant, got: {}",
            name,
            json
        );

        let deserialized: DepotManifest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.len(), 1);
    }
}
