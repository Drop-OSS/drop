use std::{mem, sync::Arc};

use anyhow::anyhow;
use log::{info, warn};
use protobuf::{EnumOrUnknown, Message};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt as _, BufReader},
    net::{
        TcpListener,
        tcp::{OwnedReadHalf, OwnedWriteHalf},
    },
    spawn,
    sync::Mutex,
};
use waitmap::WaitMap;

use crate::{
    droplet::{
        backend::{has_backend_rpc, list_files_rpc, peek_file_rpc},
        call_rpc,
        cert::{generate_client_cert_rpc, generate_root_ca_rpc},
        manifest::generate_manifest_rpc,
    },
    proto::core::{DropBound, DropBoundType, TorrentialBound, TorrentialBoundType},
};

pub mod download;

macro_rules! spawn_rpc {
    ($myself:ident, $message:ident, $func_name:ident) => {
        spawn(async move { call_rpc($myself.clone(), $message, $func_name).await });
    };
}

pub struct DropServer {
    server: TcpListener,
    write_stream: Mutex<OwnedWriteHalf>,
    waitmap: WaitMap<String, TorrentialBound>,
}

impl DropServer {
    /**
    Reads from the socket, and tries to parse it into a message,
    and then updates the waitmap with the corresponding message ID
    and content
    */
    async fn recieve_loop(
        myself: Arc<DropServer>,
        buffered_reader: &mut BufReader<OwnedReadHalf>,
    ) -> Result<(), anyhow::Error> {
        let mut length_buffer: [u8; 8] = [0; 8];
        buffered_reader.read_exact(&mut length_buffer).await?;

        let length = usize::from_le_bytes(length_buffer);
        let mut buffer = vec![0; length];

        buffered_reader.read_exact(&mut buffer).await?;

        let message = TorrentialBound::parse_from_bytes(&buffer)
            .expect("response didn't deserialize correctly");

        match message.type_.unwrap() {
            TorrentialBoundType::GENERATE_MANIFEST => {
                spawn_rpc!(myself, message, generate_manifest_rpc);
            }
            TorrentialBoundType::GENERATE_ROOT_CA => {
                spawn_rpc!(myself, message, generate_root_ca_rpc);
            }
            TorrentialBoundType::GENERATE_CLIENT_CERT => {
                spawn_rpc!(myself, message, generate_client_cert_rpc);
            }
            TorrentialBoundType::LIST_FILES_QUERY => {
                spawn_rpc!(myself, message, list_files_rpc);
            }
            TorrentialBoundType::HAS_BACKEND_QUERY => {
                spawn_rpc!(myself, message, has_backend_rpc);
            }
            TorrentialBoundType::PEEK_FILE_QUERY => {
                spawn_rpc!(myself, message, peek_file_rpc);
            }
            _ => {
                myself.waitmap.insert(message.message_id.clone(), message);
            }
        }

        Ok(())
    }

    /**
    Long-lived subroutine that never returns, runs the `recieve_loop` and reconnects
    as necessary
    */
    async fn recieve_subroutine(myself: Arc<DropServer>, read_stream: OwnedReadHalf) -> ! {
        let mut buffered_reader = BufReader::new(read_stream);

        loop {
            if let Err(err) = Self::recieve_loop(myself.clone(), &mut buffered_reader).await {
                warn!("server disconnected with error: {err:?}");

                let (drop_stream, _) = myself
                    .server
                    .accept()
                    .await
                    .expect("failed to accept new listener");
                let (read, mut write) = drop_stream.into_split();

                info!("reconnected to drop server");

                let mut lock = myself.write_stream.lock().await;
                mem::swap(&mut *lock, &mut write);

                let mut new_reader = BufReader::new(read);
                mem::swap(&mut buffered_reader, &mut new_reader);
            }
        }
    }

    /**
    Uses the waitmap to wait for a response from a query
    */
    pub async fn wait_for_message_id<T>(&self, message_id: &str) -> Result<T, anyhow::Error>
    where
        T: protobuf::Message,
    {
        let message = self
            .waitmap
            .wait(message_id)
            .await
            .ok_or(anyhow!("no response returned for value"))?;

        let message = message.value();

        if message.type_.unwrap() == crate::proto::core::TorrentialBoundType::ERROR {
            Err(anyhow!(String::from_utf8(message.data.clone()).unwrap()))
        } else {
            let response = T::parse_from_bytes(&message.data)?;
            Ok(response)
        }
    }

    /**
    Sends a message, returning the message ID
    */
    pub async fn send_message<T>(
        &self,
        message_type: DropBoundType,
        message: T,
        message_id: Option<String>,
    ) -> Result<String, anyhow::Error>
    where
        T: protobuf::Message,
    {
        let mut query = DropBound::new();
        query.message_id = message_id.unwrap_or(uuid::Uuid::new_v4().to_string());
        query.type_ = EnumOrUnknown::new(message_type);
        query.data = Vec::new();
        message.write_to_vec(&mut query.data)?;

        let mut buf = Vec::new();
        query.write_to_vec(&mut buf)?;

        {
            let mut mutex_lock = self.write_stream.lock().await;
            mutex_lock.write(&buf.len().to_le_bytes()).await?;
            mutex_lock.write_all(&buf).await?;
        };

        Ok(query.message_id)
    }
}

/**
Spins up the TCP listener, and waits for the first client to connect
Also starts the recieve subroutine
*/
pub async fn create_drop_server() -> Result<Arc<DropServer>, anyhow::Error> {
    let server = TcpListener::bind("127.0.0.1:33148").await?;

    let (drop_stream, _) = server.accept().await?;

    let (read, write) = drop_stream.into_split();

    let client = Arc::new(DropServer {
        server,
        write_stream: Mutex::new(write),
        waitmap: WaitMap::new(),
    });

    spawn(DropServer::recieve_subroutine(client.clone(), read));

    info!("created client subroutine");

    Ok(client)
}
