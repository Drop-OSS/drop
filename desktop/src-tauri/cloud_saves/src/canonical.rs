//! Reproduction of the server's `contentHash` (`server/internal/saves/hash.ts`)
//! byte for byte: sha256 over RFC 8785 canonical JSON of
//! `[{key,size,sha256,mode}]` sorted by key (code-unit-wise), with
//! `mode` defaulting to 0 and `sha256` lowercased.
//!
//! The hashed shape is fixed to these four fields, so full RFC 8785 is not
//! needed - just the exact escaped-object form of this array. Property names
//! are already emitted in canonical order (`key` < `mode` < `sha256` < `size`
//! by UTF-16 code unit), numbers are always non-negative integers (shortest
//! representation is the plain decimal), and the string escaper mirrors
//! `JSON.stringify` (ES2019 well-formed stringify) for the inputs paths can
//! contain.
//!
//! The test vectors were generated with the server's own code
//! (`json-canonicalize` + node `crypto`) - see `server/server/internal/saves/hash.ts`.

use sha2::{Digest, Sha256};

/// One file inside a save snapshot - identical to the server's `ContentFile`.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ContentFile {
    pub key: String,
    pub size: u64,
    /// Lowercase hex sha256 of the file's bytes.
    pub sha256: String,
    /// Portable mode: 0, or 0o755 when the execute bit is set.
    pub mode: u32,
}

/// The canonical JSON bytes the server hashes for `contentHash(files)`.
pub fn canonical_content_json(files: &[ContentFile]) -> Vec<u8> {
    let mut sorted: Vec<&ContentFile> = files.iter().collect();
    // Code-unit comparison: for valid UTF-8 str, Rust's byte ordering matches
    // JS's UTF-16 code-unit ordering (both degenerate identically only for
    // surrogates, which paths cannot contain as valid text).
    sorted.sort_by(|a, b| a.key.as_bytes().cmp(b.key.as_bytes()));

    let mut out = Vec::new();
    out.push(b'[');
    for (i, file) in sorted.iter().enumerate() {
        if i > 0 {
            out.push(b',');
        }
        out.extend_from_slice(br#"{"key":"#);
        escape_json_string(&file.key, &mut out);
        out.extend_from_slice(br#","mode":"#);
        out.extend_from_slice(file.mode.min(u32::from(u16::MAX)).to_string().as_bytes());
        out.extend_from_slice(br#","sha256":"#);
        escape_json_string(&file.sha256.to_ascii_lowercase(), &mut out);
        out.extend_from_slice(br#","size":"#);
        out.extend_from_slice(file.size.to_string().as_bytes());
        out.push(b'}');
    }
    out.push(b']');
    out
}

/// sha256 hex of [`canonical_content_json`] - the value the server stores as
/// `SaveVersion.contentHash` and compares `localContentHash` against.
pub fn content_hash(files: &[ContentFile]) -> String {
    hex::encode(Sha256::digest(canonical_content_json(files)))
}

/// `JSON.stringify` string escaping: the two mandatory short escapes plus
/// `\b \t \n \f \r`, `\uXXXX` for the remaining C0 controls, everything else
/// passed through as UTF-8. (Lone surrogates cannot occur: keys are built
/// from valid UTF-8.)
fn escape_json_string(s: &str, out: &mut Vec<u8>) {
    out.push(b'"');
    for c in s.chars() {
        match c {
            '"' => out.extend_from_slice(br#"\""#),
            '\\' => out.extend_from_slice(br"\\"),
            '\u{8}' => out.extend_from_slice(br"\b"),
            '\u{c}' => out.extend_from_slice(br"\f"),
            '\n' => out.extend_from_slice(br"\n"),
            '\r' => out.extend_from_slice(br"\r"),
            '\t' => out.extend_from_slice(br"\t"),
            c if (c as u32) < 0x20 => {
                out.extend_from_slice(format!("\\u{:04x}", c as u32).as_bytes());
            }
            c => {
                let mut buf = [0u8; 4];
                out.extend_from_slice(c.encode_utf8(&mut buf).as_bytes());
            }
        }
    }
    out.push(b'"');
}

#[cfg(test)]
mod tests {
    use super::*;

    fn files() -> Vec<(&'static str, Vec<ContentFile>, &'static str)> {
        // Vectors generated against the server implementation
        // (`json-canonicalize` + node crypto); these values must never change.
        vec![
            (
                "empty",
                vec![],
                "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
            ),
            (
                "single",
                vec![ContentFile {
                    key: "MyGame/save.sav".into(),
                    size: 5,
                    sha256: "a".repeat(64),
                    mode: 0,
                }],
                "148ac415911c47228c10c2adacc88347b2c3a5b37594016549ccec419057cb09",
            ),
            (
                "ordered",
                vec![
                    ContentFile {
                        key: "b/save.dat".into(),
                        size: 12,
                        sha256: "B".repeat(64),
                        mode: 0o755,
                    },
                    ContentFile {
                        key: "a/cfg/settings.ini".into(),
                        size: 8,
                        sha256: "c".repeat(64),
                        mode: 0,
                    },
                ],
                "b79779535c25e3317ad3576ddbe2c394a5fcd264870b33450968d3ddb2b443b7",
            ),
            (
                "tricky",
                vec![
                    ContentFile {
                        key: "My Game/Saved Games/Slot 1/ünïcode.sav".into(),
                        size: 1,
                        sha256: "0".repeat(64),
                        mode: 0,
                    },
                    ContentFile {
                        key: "My Game/quote\\backslash\"tab\tnewline\n".into(),
                        size: 2,
                        sha256: "f".repeat(64),
                        mode: 0o644,
                    },
                ],
                "e2114d3659714f6af3df82da0a3c5a874391407157cbbd265fbd7735e9f5606d",
            ),
        ]
    }

    #[test]
    fn matches_the_server_hash() {
        for (name, input, expected) in files() {
            assert_eq!(content_hash(&input), expected, "vector {name}");
        }
    }

    #[test]
    fn canonical_form_is_stable_under_input_order() {
        let mut shuffled = files()[2].1.clone().into_iter().rev().collect::<Vec<_>>();
        assert_eq!(
            canonical_content_json(&shuffled),
            canonical_content_json(&files()[2].1)
        );
        shuffled.push(ContentFile {
            key: "b/other".into(),
            size: 1,
            sha256: "d".repeat(64),
            mode: 0,
        });
        assert_ne!(
            canonical_content_json(&shuffled),
            canonical_content_json(&files()[2].1)
        );
    }

    #[test]
    fn sha_case_is_normalised() {
        let upper = [ContentFile {
            key: "k".into(),
            size: 1,
            sha256: "A".repeat(64),
            mode: 0,
        }];
        let lower = [ContentFile {
            key: "k".into(),
            size: 1,
            sha256: "a".repeat(64),
            mode: 0,
        }];
        assert_eq!(content_hash(&upper), content_hash(&lower));
    }
}
