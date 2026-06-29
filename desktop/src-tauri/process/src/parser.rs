use std::path::{Path, PathBuf};

use log::info;

use crate::error::ProcessError;

#[derive(Debug)]
pub struct ParsedCommand {
    pub env: Vec<String>,
    pub command: String,
    pub args: Vec<String>,
}

impl ParsedCommand {
    pub fn parse(raw: String) -> Result<Self, ProcessError> {
        let parts =
            shell_words::split(&raw).map_err(|e| ProcessError::InvalidArguments(e.to_string()))?;
        let args =
            parts
                .iter()
                .position(|v| !v.contains("="))
                .ok_or(ProcessError::InvalidArguments(
                    "Cannot parse launch".to_owned(),
                ))?;
        let env = &parts[0..args];
        let command = parts[args].clone();
        let args = &parts[(args + 1)..];

        Ok(Self {
            args: args.to_vec(),
            command,
            env: env.to_vec(),
        })
    }

    pub fn make_absolute(&mut self, base: PathBuf) {
        self.command = base
            .join(self.command.clone())
            .to_string_lossy()
            .to_string();
    }

    pub fn make_command_absolute_if_local(&mut self, base: &Path) {
        let candidate = base.join(&self.command);
        if candidate.is_file() {
            info!(
                "resolved local command '{}' to absolute path '{}'",
                self.command,
                candidate.display()
            );
            self.command = candidate.to_string_lossy().to_string();
        } else {
            info!(
                "command '{}' is not a local file in '{}', leaving as-is for PATH resolution",
                self.command,
                base.display()
            );
        }
    }

    pub fn ensure_executable(&self) -> Result<(), ProcessError> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            if let Ok(metadata) = std::fs::metadata(&self.command) {
                let is_executable =
                    metadata.is_file() && metadata.permissions().mode() & 0o111 != 0;
                if !is_executable {
                    return Err(ProcessError::NotExecutable(self.command.clone()));
                }
            }
        }

        Ok(())
    }

    pub fn reconstruct(self) -> String {
        let mut v = vec![];
        v.extend(self.env);
        v.extend_one(self.command);
        v.extend(self.args);
        shell_words::join(v)
    }
}

pub struct LaunchParameters(pub ParsedCommand, pub PathBuf);
