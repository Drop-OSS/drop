use std::{env, path::PathBuf};

use droplet_rs::manifest::generate_manifest_rusty;
use tokio::runtime::Handle;

#[tokio::main]
pub async fn main() {
    let mut args = env::args();
    let target_dir = PathBuf::from(args.nth(1).expect("Provide target directory"));

    let metrics = Handle::current().metrics();
    println!("using {} workers", metrics.num_workers());

    let _manifest = generate_manifest_rusty(
        &target_dir,
        |progress| println!("PROGRESS: {}", progress),
        |message| {
            println!("{}", message);
        },
        None,
    )
    .await
    .unwrap();
}
