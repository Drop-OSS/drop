use crate::proto::version::version_response::Manifest;

fn fixed_length<T, const N: usize>(v: Vec<T>) -> [T; N] {
    v.try_into()
        .unwrap_or_else(|v: Vec<T>| panic!("Expected a Vec of length {} but it was {}", N, v.len()))
}

pub fn convert_protobuf_manifest(source: Manifest) -> droplet_rs::manifest::Manifest {
    droplet_rs::manifest::Manifest {
        version: source.version,
        chunks: source
            .chunks
            .into_iter()
            .map(|(id, chunk_data)| {
                (
                    id,
                    droplet_rs::manifest::ChunkData {
                        files: chunk_data
                            .files
                            .into_iter()
                            .map(|file_entry| droplet_rs::manifest::FileEntry {
                                filename: file_entry.filename,
                                start: file_entry.start.try_into().unwrap(),
                                length: file_entry.length.try_into().unwrap(),
                                permissions: file_entry.permissions,
                            })
                            .collect(),
                        checksum: chunk_data.checksum,
                        iv: fixed_length(chunk_data.iv),
                    },
                )
            })
            .collect(),
        size: source.size,
        key: fixed_length(source.key),
    }
}
