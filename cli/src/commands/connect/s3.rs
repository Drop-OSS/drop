use clap::Args;
use opendal::Operator;
use serde::{Deserialize, Serialize};

use crate::{
    commands::connect::{config_option::ConfigOption, configurable::Configure},
    interactive_variable,
    operator_builder::OperatorBuilder,
};

#[derive(Args, Clone)]
pub struct S3ConfigCli {
    key_id: Option<String>,
    secret_key: Option<String>,
    endpoint: Option<String>,
    region: Option<String>,
    bucket_name: Option<String>,
    root: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct S3Config {
    pub key_id: String,
    pub secret_key: String,
    pub endpoint: String,
    pub region: String,
    pub bucket_name: String,
    pub root: Option<String>,
}

impl Configure for S3ConfigCli {
    async fn configure(self, name: &mut Option<String>) -> anyhow::Result<ConfigOption> {
        interactive_variable!(self, key_id, "S3 Key ID");
        interactive_variable!(self, secret_key, "S3 Secret Key");
        interactive_variable!(self, region, "S3 Region");
        interactive_variable!(self, bucket_name, "S3 Bucket Name");
        interactive_variable!(self, endpoint, "S3 Endpoint");
        if let None = name {
            *name = Some(endpoint.clone());
        }
        Ok(ConfigOption::S3(S3Config {
            secret_key,
            key_id,
            region,
            bucket_name,
            endpoint,
            root: self.root,
        }))
    }
}

impl OperatorBuilder for S3Config {
    fn build(&self) -> anyhow::Result<Operator> {
        let builder = opendal::services::S3::default()
            .access_key_id(&self.key_id)
            .secret_access_key(&self.secret_key)
            .region(&self.region)
            .endpoint(&self.endpoint)
            .root(self.root.as_deref().unwrap_or("/"))
            .bucket(&self.bucket_name)
            .disable_config_load();

        let op: Operator = Operator::new(builder)?.finish();

        Ok(op)
    }
}
