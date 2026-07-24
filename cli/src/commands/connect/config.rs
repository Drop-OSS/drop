use crate::{
    commands::connect::{
        config_option::{ConfigOption, ConfigOptionCli},
        configurable::Configure,
        speedtest::{SPEEDTEST_PATH, Speedtest},
    },
    manifest::DepotManifest,
};
use dialoguer::{Confirm, theme::ColorfulTheme};
use futures::AsyncWriteExt;
use indicatif::{ProgressBar, ProgressStyle};
use log::{debug, info};
use opendal::Operator;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, ops::Not};
use tokio_util::compat::FuturesAsyncWriteCompatExt;

const CONFIG_DIR: &str = "downpour/config.json";

#[derive(Serialize, Deserialize)]
pub struct Config {
    configurations: HashMap<String, ConfigOption>,
    active: Option<String>,
}
impl Config {
    pub fn new() -> Self {
        Self {
            configurations: HashMap::new(),
            active: None,
        }
    }
    pub fn exists(&self, name: &String) -> bool {
        self.configurations.contains_key(name)
    }
    pub fn is_empty(&self) -> bool {
        self.configurations.is_empty()
    }
    pub fn len(&self) -> usize {
        self.configurations.len()
    }
    pub fn save(&self) -> anyhow::Result<()> {
        let json = serde_json::to_string(self)?;
        let save_path = dirs::config_dir()
            .expect("Apparently your home directory doesn't exist") // Should probably formalise that error
            .join(CONFIG_DIR);
        fs::create_dir_all(save_path.parent().unwrap())?;
        fs::write(save_path, json)?;
        Ok(())
    }
    pub fn read() -> Self {
        let save_path = dirs::config_dir()
            .expect("Apparently your home directory doesn't exist") // Should probably formalise that error
            .join(CONFIG_DIR);
        if fs::exists(&save_path)
            .unwrap_or_else(|_| panic!("Could not read save path {:#?}", &save_path))
        {
            serde_json::from_str(&fs::read_to_string(save_path).unwrap()).unwrap()
        } else {
            Config::new()
        }
    }
    pub fn add_item(&mut self, name: String, object: ConfigOption) {
        if matches!(object, ConfigOption::S3(..)) {
            self.active = Some(name.clone())
        }
        self.configurations.insert(name, object);
        self.save().expect("Failed to save config");
    }

    pub fn get_active(&self) -> Option<&ConfigOption> {
        if let Some(active) = &self.active {
            self.configurations.get(active)
        } else {
            None
        }
    }
    pub fn get<T: AsRef<str>>(&self, name: T) -> Option<&ConfigOption> {
        self.configurations.get(name.as_ref())
    }
}

pub async fn manage_configuration(
    config: &mut Config,
    name: Option<String>,
    option: ConfigOptionCli,
) -> anyhow::Result<()> {
    let mut name = name;
    if let Some(name) = &name
        && config.exists(name)
    {
        let confirm = Confirm::with_theme(&ColorfulTheme::default())
            .with_prompt(format!(
                "An entry already exists with the name \"{}\". Would you like to overwrite it?",
                name
            ))
            .interact()?;
        if !confirm {
            return Err(anyhow::anyhow!("User cancelled action"));
        }
    }
    let config_option = match option {
        ConfigOptionCli::S3(s3_config_cli) => s3_config_cli.clone().configure(&mut name).await?,
    };
    let name = name.expect("Default name was not provided by ConfigOption. This is a bug");
    config.add_item(name, config_option.clone());
    let operator = config_option.build()?;

    generate_manifest(&operator).await?;
    info!("Finished uploading manifest");
    generate_speedtest(&operator).await?;
    info!("Finished uploading speedtest");
    Ok(())
}

async fn generate_speedtest(operator: &Operator) -> anyhow::Result<()> {
    // Workaround to operator.exists("...") also logging a 404 warning
    let lister = operator.list_with(SPEEDTEST_PATH).limit(1).await?;
    if lister.is_empty().not() {
        info!("Speedtest already exists on Depot. Skipping speedtest upload...");
        return Ok(());
    }
    let mut writer = operator
        .writer(SPEEDTEST_PATH)
        .await?
        .into_futures_async_write()
        .compat_write();

    let progress_bar = ProgressBar::new(10_000).with_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] [ETA {eta}] {bar} {percent_precise}%")
            .unwrap(),
    );

    let mut reader = Speedtest::new(|progress| {
        let progress_int = (progress * 100f32).round() as u64;
        progress_bar.set_position(progress_int);
    });
    let written = tokio::io::copy(&mut reader, &mut writer).await?;
    progress_bar.finish();
    debug!("Wrote {} bytes to {:?}", written, operator.info());
    writer.into_inner().close().await?;
    debug!("Closed writer");
    Ok(())
}

async fn generate_manifest(operator: &Operator) -> anyhow::Result<()> {
    let lister = operator.list_with("manifest.json").limit(1).await?;
    if lister.is_empty().not() {
        info!("Manifest already exists on Depot. Skipping manifest upload...");
        return Ok(());
    }
    let data = DepotManifest::new();
    operator
        .write("manifest.json", serde_json::to_string(&data)?)
        .await?;

    Ok(())
}
