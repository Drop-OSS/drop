use std::{
    fs::{self, create_dir_all},
    mem::ManuallyDrop,
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::{PoisonError, RwLock, RwLockReadGuard, RwLockWriteGuard},
};

use aes::cipher::{KeyIvInit as _, StreamCipher as _};
use anyhow::Error;
use chrono::Utc;
use log::{debug, error, info, warn};
use url::Url;

use crate::{
    db::{DATA_ROOT_DIR, DB, KEY_IV},
    models::{
        self,
        data::{Database, DatabaseVersionSerializable},
    },
};

type Aes128Ctr64LE = ctr::Ctr64LE<aes::Aes128>;

pub struct DatabaseInterface {
    data: RwLock<models::data::Database>,
    path: PathBuf,
}
impl DatabaseInterface {
    pub fn set_up_database() -> Self {
        let db_path = DATA_ROOT_DIR.join("drop.db");
        let games_base_dir = DATA_ROOT_DIR.join("games");
        let logs_root_dir = DATA_ROOT_DIR.join("logs");
        let cache_dir = DATA_ROOT_DIR.join("cache");
        let pfx_dir = DATA_ROOT_DIR.join("pfx");

        debug!("creating data directory at {DATA_ROOT_DIR:?}");
        create_dir_all(DATA_ROOT_DIR.as_path()).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                DATA_ROOT_DIR.display(),
                e
            )
        });
        create_dir_all(&games_base_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                games_base_dir.display(),
                e
            )
        });
        create_dir_all(&logs_root_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                logs_root_dir.display(),
                e
            )
        });
        create_dir_all(&cache_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                cache_dir.display(),
                e
            )
        });
        create_dir_all(&pfx_dir).unwrap_or_else(|e| {
            panic!(
                "Failed to create directory {} with error {}",
                pfx_dir.display(),
                e
            )
        });

        let exists = fs::exists(db_path.clone()).unwrap_or_else(|e| {
            panic!(
                "Failed to find if {} exists with error {}",
                db_path.display(),
                e
            )
        });

        if exists {
            match DatabaseInterface::open_at_path(&db_path) {
                Ok(db) => db.unwrap(),
                Err(e) => handle_invalid_database(e, db_path, games_base_dir, cache_dir)
                    .expect("failed to recover from failed database"),
            }
        } else {
            let default = Database::new(games_base_dir, None, cache_dir);
            debug!("Creating database at path {}", db_path.display());
            DatabaseInterface::create_at_path(&db_path, default)
                .expect("Database could not be created")
        }
    }

    pub fn open_at_path(db_path: &Path) -> Result<Option<DatabaseInterface>, Error> {
        if !db_path.exists() {
            return Ok(None);
        };
        let mut database_data = std::fs::read(db_path)?;
        let (key, iv) = *KEY_IV;
        let mut cipher = Aes128Ctr64LE::new(&key.into(), &iv.into());
        cipher.apply_keystream(&mut database_data);

        let database_data = String::from_utf8(database_data)?;

        let database_data: DatabaseVersionSerializable = ron::from_str(&database_data)?;
        Ok(Some(DatabaseInterface {
            data: RwLock::new(database_data.0),
            path: db_path.to_path_buf(),
        }))
    }

    pub fn create_at_path(db_path: &Path, database: Database) -> Result<DatabaseInterface, Error> {
        let database = DatabaseVersionSerializable(database);
        let mut database_data = ron::to_string(&database)?.into_bytes();

        let (key, iv) = *KEY_IV;
        let mut cipher = Aes128Ctr64LE::new(&key.into(), &iv.into());
        cipher.apply_keystream(&mut database_data);

        std::fs::write(db_path, database_data)?;
        Ok(DatabaseInterface {
            data: RwLock::new(database.0),
            path: db_path.to_path_buf(),
        })
    }

    pub fn database_is_set_up(&self) -> bool {
        !borrow_db_checked().base_url.is_empty()
    }

    pub fn fetch_base_url(&self) -> Url {
        let handle = borrow_db_checked();
        Url::parse(&handle.base_url)
            .unwrap_or_else(|_| panic!("Failed to parse base url {}", handle.base_url))
    }

    fn save(&self) -> Result<(), Error> {
        let lock = self.data.read().expect("failed to lock database to save");
        DatabaseInterface::create_at_path(&self.path, lock.clone())?;
        Ok(())
    }

    fn borrow_data(
        &self,
    ) -> Result<
        std::sync::RwLockReadGuard<'_, Database>,
        PoisonError<std::sync::RwLockReadGuard<'_, Database>>,
    > {
        self.data.read()
    }

    fn borrow_data_mut(
        &self,
    ) -> Result<
        std::sync::RwLockWriteGuard<'_, Database>,
        PoisonError<std::sync::RwLockWriteGuard<'_, Database>>,
    > {
        self.data.write()
    }
}

// PENDING: Make the error relelvant rather than just assume that it's a Deserialize error
fn handle_invalid_database(
    error: Error,
    db_path: PathBuf,
    games_base_dir: PathBuf,
    cache_dir: PathBuf,
) -> Result<DatabaseInterface, Error> {
    warn!("{error:?}");
    let new_path = {
        let time = Utc::now().timestamp();
        let mut base = db_path.clone();
        base.set_file_name(format!("drop.db.backup-{time}"));
        base
    };
    info!("old database stored at: {}", new_path.to_string_lossy());
    fs::rename(&db_path, &new_path).unwrap_or_else(|e| {
        panic!(
            "Could not rename database {} to {} with error {}",
            db_path.display(),
            new_path.display(),
            e
        )
    });
    fs::remove_dir_all(cache_dir.clone())?;
    fs::create_dir_all(cache_dir.clone())?;

    let db = Database::new(games_base_dir, Some(new_path), cache_dir);

    Ok(DatabaseInterface::create_at_path(&db_path, db).expect("Database could not be created"))
}

// To automatically save the database upon drop
pub struct DBRead<'a>(RwLockReadGuard<'a, Database>);
pub struct DBWrite<'a>(ManuallyDrop<RwLockWriteGuard<'a, Database>>);
impl<'a> Deref for DBWrite<'a> {
    type Target = Database;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl<'a> DerefMut for DBWrite<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
impl<'a> Deref for DBRead<'a> {
    type Target = Database;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl Drop for DBWrite<'_> {
    fn drop(&mut self) {
        unsafe {
            ManuallyDrop::drop(&mut self.0);
        }

        match DB.save() {
            Ok(()) => {}
            Err(e) => {
                error!("database failed to save with error {e}");
                panic!("database failed to save with error {e}")
            }
        }
    }
}

pub fn borrow_db_checked<'a>() -> DBRead<'a> {
    match DB.borrow_data() {
        Ok(data) => DBRead(data),
        Err(e) => {
            error!("database borrow failed with error {e}");
            panic!("database borrow failed with error {e}");
        }
    }
}

pub fn borrow_db_mut_checked<'a>() -> DBWrite<'a> {
    match DB.borrow_data_mut() {
        Ok(data) => DBWrite(ManuallyDrop::new(data)),
        Err(e) => {
            error!("database borrow mut failed with error {e}");
            panic!("database borrow mut failed with error {e}");
        }
    }
}
