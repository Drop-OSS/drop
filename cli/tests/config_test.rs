use downpour::commands::connect::config::Config;
use downpour::commands::connect::config_option::ConfigOption;
use downpour::commands::connect::s3::S3Config;

#[test]
fn test_config_new_is_empty() {
    let config = Config::new();
    assert!(config.get_active().is_none());
}

#[test]
fn test_config_exists_after_add() {
    let mut config = Config::new();
    let name = "test-depot".to_string();
    let option = ConfigOption::S3(S3Config {
        key_id: "AKID".into(),
        secret_key: "secret".into(),
        endpoint: "https://s3.example.com".into(),
        region: "us-east-1".into(),
        bucket_name: "games".into(),
        root: Some("/games".into()),
    });

    assert!(!config.exists(&name));
    config.add_item(name.clone(), option);
    assert!(config.exists(&name));
}

#[test]
fn test_config_get_returns_added_item() {
    let mut config = Config::new();
    let name = "my-depot".to_string();
    let option = ConfigOption::S3(S3Config {
        key_id: "AKID123".into(),
        secret_key: "sekret".into(),
        endpoint: "https://s3.example.com".into(),
        region: "eu-west-1".into(),
        bucket_name: "drop-bucket".into(),
        root: None,
    });

    config.add_item(name.clone(), option.clone());

    let retrieved = config.get(&name);
    assert!(retrieved.is_some());

    match retrieved.unwrap() {
        ConfigOption::S3(s3) => {
            assert_eq!(s3.key_id, "AKID123");
            assert_eq!(s3.endpoint, "https://s3.example.com");
        }
    }
}

#[test]
fn test_config_get_active_returns_s3_depot() {
    let mut config = Config::new();
    let option = ConfigOption::S3(S3Config {
        key_id: "AKID".into(),
        secret_key: "secret".into(),
        endpoint: "https://s3.example.com".into(),
        region: "us-east-1".into(),
        bucket_name: "games".into(),
        root: None,
    });

    config.add_item("active-depot".to_string(), option);
    assert!(config.get_active().is_some());
}

#[test]
fn test_config_get_nonexistent_returns_none() {
    let config = Config::new();
    assert!(config.get("nonexistent").is_none());
}

#[test]
fn test_config_serde_roundtrip() {
    let mut config = Config::new();
    config.add_item(
        "depot-a".to_string(),
        ConfigOption::S3(S3Config {
            key_id: "AKID".into(),
            secret_key: "secret".into(),
            endpoint: "https://s3.example.com".into(),
            region: "us-west-2".into(),
            bucket_name: "drop".into(),
            root: Some("/drop".into()),
        }),
    );

    // Serialize
    let json = serde_json::to_string(&config).expect("serialize config");
    assert!(!json.is_empty());

    // Deserialize
    let deserialized: Config = serde_json::from_str(&json).expect("deserialize config");

    // Verify roundtrip preserved data
    assert!(deserialized.exists(&"depot-a".to_string()));
    assert!(deserialized.get_active().is_some());

    let retrieved = deserialized.get("depot-a").unwrap();
    match retrieved {
        ConfigOption::S3(s3) => {
            assert_eq!(s3.endpoint, "https://s3.example.com");
            assert_eq!(s3.bucket_name, "drop");
            assert_eq!(s3.root.as_deref(), Some("/drop"));
        }
    }
}
