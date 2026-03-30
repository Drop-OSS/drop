use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use native_model::Model;
use native_model_macro::native_model;
use serde::{Deserialize, Serialize};
#[derive(Serialize, Deserialize)]
#[native_model(id = 1, version = 1)]
struct Data(Vec<u8>);

fn wrap(data: &mut Vec<u8>) {
    native_model::wrapper::native_model_encode(data, 1, 1);
}

fn unwrap(data: &mut Vec<u8>) {
    native_model::wrapper::Wrapper::deserialize(&data[..]).unwrap();
}

fn criterion_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("encode");

    // 1 byte, 1KB, 1MB, 10MB, 100MB
    for nb_bytes in [1, 1024, 1024 * 1024, 10 * 1024 * 1024, 100 * 1024 * 1024].into_iter() {
        group.throughput(criterion::Throughput::Bytes(nb_bytes as u64));

        // encode
        let data = Data(vec![1; nb_bytes]);
        let mut encode_body = data.native_model_encode_body().unwrap();
        group.bench_function(BenchmarkId::new("encode", nb_bytes), |b| {
            b.iter(|| wrap(&mut encode_body))
        });

        // decode
        let data = Data(vec![1; nb_bytes]);
        let mut encode_body = native_model::encode(&data).unwrap();
        group.bench_function(BenchmarkId::new("decode", nb_bytes), |b| {
            b.iter(|| unwrap(&mut encode_body))
        });
    }
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
