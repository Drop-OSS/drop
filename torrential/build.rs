use std::fs::{self, read_dir};

use protobuf_codegen::Codegen;

const OUT_DIR: &str = "./src/proto/";

fn main() {
    let files = read_dir("./proto").unwrap();
    let files = files.map(|v| format!("proto/{}", v.unwrap().file_name().into_string().unwrap()));

    read_dir(OUT_DIR).unwrap().for_each(|v| {
        if let Ok(entry) = v
            && entry.file_name().to_str().unwrap().ends_with(".rs") {
                fs::remove_file(entry.path()).unwrap();
            }
    });

    Codegen::new()
        .protoc_path(&protoc_bin_vendored::protoc_bin_path().unwrap())
        .inputs(files)
        .include("proto")
        .out_dir(OUT_DIR)
        .run()
        .unwrap();
}
