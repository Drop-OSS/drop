use std::collections::HashMap;

use dynfmt::{Argument, FormatArgs};

pub struct DropFormatArgs {
    positional: Vec<String>,
    map: HashMap<&'static str, String>,
}

impl DropFormatArgs {
    pub fn new(
        launch_string: String,
        working_dir: &String,
        executable_name: &String,
        absolute_executable_name: String,
        original: Option<String>,
    ) -> Self {
        let mut positional = Vec::new();
        let mut map: HashMap<&'static str, String> = HashMap::new();

        positional.push(launch_string);

        map.insert("dir", working_dir.to_string());
        map.insert("exe", executable_name.to_string());
        map.insert("abs_exe", absolute_executable_name);

        if let Some(original) = original {
            map.insert("rom", original);
        }

        Self { positional, map }
    }
}

impl FormatArgs for DropFormatArgs {
    fn get_index(&self, index: usize) -> Result<Option<dynfmt::Argument<'_>>, ()> {
        Ok(self.positional.get(index).map(|arg| arg as Argument<'_>))
    }

    fn get_key(&self, key: &str) -> Result<Option<dynfmt::Argument<'_>>, ()> {
        Ok(self.map.get(key).map(|arg| arg as Argument<'_>))
    }
}
