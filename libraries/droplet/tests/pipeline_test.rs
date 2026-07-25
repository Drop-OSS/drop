use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use droplet_rs::manifest::generate_manifest_rusty;

/// Temporary directory guard — cleans up on drop.
struct TempDir {
    path: PathBuf,
}

impl TempDir {
    fn new(prefix: &str) -> Self {
        let mut path = std::env::temp_dir();
        let thread_id = std::thread::current().id();
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        path.push(format!("{}_{:?}_{}", prefix, thread_id, ts));
        std::fs::create_dir_all(&path).expect("failed to create temp dir");
        TempDir { path }
    }

    fn path(&self) -> &std::path::Path {
        &self.path
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.path).ok();
    }
}

/// Convenient — write a file (and create parent dirs) in one call.
fn write_file(path: &std::path::Path, content: &[u8]) {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).expect("failed to create parent dirs");
    }
    std::fs::write(path, content).unwrap_or_else(|e| panic!("failed to write {:?}: {}", path, e));
}

// ---------------------------------------------------------------------------
// Pipeline integration test
// ---------------------------------------------------------------------------
#[test]
fn directory_to_manifest_pipeline() {
    // ---- 1. prepare test directory ----------------------------------------
    let tmp = TempDir::new("drop_pipeline_test");
    let dir = tmp.path().to_path_buf();

    // Small file (fits in one chunk with others)
    write_file(&dir.join("hello.txt"), b"Hello, World!");

    // Binary-ish file
    let binary_content: Vec<u8> = (0u8..255).cycle().take(4096).collect();
    write_file(&dir.join("data.bin"), &binary_content);

    // File in a sub-directory
    write_file(
        &dir.join("nested/readme.md"),
        b"# Nested\n\nThis is a nested file.",
    );

    // Deeper nesting
    write_file(
        &dir.join("a/b/c/deep.txt"),
        b"deeply nested file content here",
    );

    // Empty file
    write_file(&dir.join("empty.dat"), b"");

    let total_expected_size = b"Hello, World!".len() as u64
        + 4096u64
        + b"# Nested\n\nThis is a nested file.".len() as u64
        + b"deeply nested file content here".len() as u64
        + 0u64;

    // ---- 2. generate manifest --------------------------------------------
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    let call_count = AtomicUsize::new(0);

    let manifest = rt
        .block_on(generate_manifest_rusty(
            &dir,
            |_progress: f32| {
                call_count.fetch_add(1, Ordering::Relaxed);
            },
            |message: String| {
                eprintln!("[manifest] {}", message);
            },
            None::<&dyn droplet_rs::manifest::ManifestWriterFactory<Writer = tokio::io::Sink>>,
            None::<&tokio::sync::Semaphore>,
        ))
        .expect("generate_manifest_rusty should succeed");

    // ---- 3. validate manifest structure -----------------------------------

    // Version
    assert_eq!(&manifest.version, "2", "manifest version should be \"2\"");

    // Key must be 16 random bytes (non-zero in practice)
    assert_eq!(manifest.key.len(), 16, "key must be 16 bytes");

    // Total size must match sum of all file contents
    assert_eq!(
        manifest.size, total_expected_size,
        "manifest.size should equal sum of file sizes"
    );

    // Must have at least one chunk
    assert!(
        !manifest.chunks.is_empty(),
        "manifest must have at least one chunk"
    );

    // Collect all file entries from all chunks
    let all_files: Vec<_> = manifest
        .chunks
        .values()
        .flat_map(|chunk| &chunk.files)
        .collect();

    // ---- 4. validate file entries ----------------------------------------
    let expected_files = [
        "hello.txt",
        "data.bin",
        "nested/readme.md",
        "a/b/c/deep.txt",
        "empty.dat",
    ];

    for expected in &expected_files {
        assert!(
            all_files.iter().any(|f| f.filename == *expected),
            "manifest should contain file '{}'",
            expected
        );
    }

    // Check specific file sizes
    for file_entry in &all_files {
        match file_entry.filename.as_str() {
            "hello.txt" => assert_eq!(file_entry.length, 13),
            "data.bin" => assert_eq!(file_entry.length, 4096),
            "empty.dat" => assert_eq!(file_entry.length, 0),
            "nested/readme.md" => assert!(
                file_entry.length > 0,
                "readme.md should have non-zero length"
            ),
            "a/b/c/deep.txt" => assert!(
                file_entry.length > 0,
                "deep.txt should have non-zero length"
            ),
            other => panic!("unexpected file in manifest: {}", other),
        }
    }

    // ---- 5. validate chunk integrity -------------------------------------
    for (chunk_id, chunk) in &manifest.chunks {
        assert!(
            !chunk.files.is_empty(),
            "chunk {} should have at least one file",
            chunk_id
        );
        assert!(
            !chunk.checksum.is_empty(),
            "chunk {} should have a checksum",
            chunk_id
        );
        assert_eq!(
            chunk.iv.len(),
            16,
            "chunk {} IV should be 16 bytes",
            chunk_id
        );
    }

    // ---- 6. verify progress callback was called ---------------------------
    assert!(
        call_count.load(Ordering::Relaxed) > 0,
        "progress callback should have been called at least once"
    );

    eprintln!(
        "manifest: {} chunks, {} total files, {} bytes",
        manifest.chunks.len(),
        all_files.len(),
        manifest.size
    );
}

// ---------------------------------------------------------------------------
// Larger data test — verifies chunking logic across multiple files
// ---------------------------------------------------------------------------
#[test]
fn multi_chunk_manifest_pipeline() {
    let tmp = TempDir::new("drop_multichunk_test");
    let dir = tmp.path().to_path_buf();

    // Create enough small files to force at least a couple of chunks
    // CHUNK_SIZE = 64 MiB, so we need ~128 MiB of files ≈ 8 files × 16 MiB each
    let file_size = 16 * 1024 * 1024; // 16 MiB — fits 4 per chunk
    let file_count = 9; // 9 × 16 MiB = 144 MiB → at least 2 full chunks

    // Use deterministic content — large enough to matter, fast to generate
    let content_block = b"The quick brown fox jumps over the lazy dog. ";

    for i in 0..file_count {
        let content: Vec<u8> = content_block
            .iter()
            .copied()
            .cycle()
            .take(file_size as usize)
            .collect();
        write_file(&dir.join(format!("file_{}.bin", i)), &content);
    }

    let total_expected = file_count as u64 * file_size as u64;

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    let manifest = rt
        .block_on(generate_manifest_rusty(
            &dir,
            |_| {},
            |msg| eprintln!("[manifest] {}", msg),
            None::<&dyn droplet_rs::manifest::ManifestWriterFactory<Writer = tokio::io::Sink>>,
            None::<&tokio::sync::Semaphore>,
        ))
        .expect("generate_manifest_rusty should succeed on multi-chunk data");

    // Verify total size
    assert_eq!(manifest.size, total_expected);

    // Manual: 9 × 16 MiB = 144 MiB.
    // At 64 MiB per chunk = ceil(144/64) = 3 chunks minimum.
    // (Actually 2 chunks of 64 MiB + 1 of 16 MiB = 3).
    assert!(
        manifest.chunks.len() >= 2,
        "expected at least 2 chunks, got {}",
        manifest.chunks.len()
    );

    // Every file must appear exactly once across all chunks
    let all_files: Vec<_> = manifest.chunks.values().flat_map(|c| &c.files).collect();

    assert_eq!(
        all_files.len(),
        file_count,
        "all {} files should appear in manifest",
        file_count
    );

    for file_entry in &all_files {
        assert_eq!(file_entry.length as u64, file_size);
    }

    // Each chunk must have a non-empty checksum
    // (Note: identical content in different chunks produces same hash — that's correct SHA256)
    for (chunk_id, chunk) in &manifest.chunks {
        assert!(
            !chunk.checksum.is_empty(),
            "chunk {} must have a checksum",
            chunk_id
        );
        assert!(
            !chunk.files.is_empty(),
            "chunk {} must have files",
            chunk_id
        );
    }

    eprintln!(
        "multi-chunk manifest: {} chunks, {} files, {} bytes",
        manifest.chunks.len(),
        all_files.len(),
        manifest.size
    );
}
