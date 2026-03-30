use std::{
    cmp,
    fs::File,
    io::{BufWriter, Write},
};

use criterion::{Criterion, criterion_group, criterion_main};
use rand::{Rng, rng};
use tempfile::tempfile;
use tokio::runtime::Runtime;

async fn torrential() {}

fn generate_file() -> File {
    let total_bytes = 312 * 1024 * 1024;
    let tempfile = tempfile().unwrap();
    let mut writer = BufWriter::new(tempfile);

    let mut rng = rng();
    let mut buffer = [0; 1024];
    let mut remaining_size = total_bytes;

    while remaining_size > 0 {
        let to_write = cmp::min(remaining_size, buffer.len());
        let buffer = &mut buffer[..to_write];
        rng.fill(buffer);
        writer.write(buffer).unwrap();

        remaining_size -= to_write;
    }
    writer.into_inner().unwrap()
}
// The benchmark function setup
fn benchmark(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let file = generate_file();

    c.bench_function("torrential download", |b| {
        b.to_async(&rt).iter(|| torrential())
    });
}

// Grouping your benchmarks
criterion_group!(benches, benchmark);
criterion_main!(benches);
