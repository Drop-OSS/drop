# torrential service

The role of torrential has expanded recently to be the source of ALL Rust/native execution within Drop, to avoid using the buggy napi.rs `droplet` package.

It communicates over `127.0.0.1:33148`, which the service connects to and stores the socket handle to.

## message format

Each message is prefixed with an 8 byte little-endian unsigned integer that dictates the length of the message. Then, they are wrapped in the respective DropBound or TorrentialBound wrappers, which contain the type and data fields, which dictate which sub-message they are deserialized into.

## query processors

**Note: "Query" is the old name for a DropBound message**

The service allows you to configure a series of query processors that match based on type and recieve the raw message to deserialize themselves. They can optionally return a response message, which automatically gets returned and wrapped.

## message ids

All messages in the pipe have a message ID which dictates which "request" they're for. Queries and responses (DropBound and TorrentialBound) carry the same message ID if they are related.

## old `/api/v1/admin/depot/torrential/*` routes

They've been turned into query and response messages as described above.

# torrential service internals

We use a read buffer to queue up enough bytes that we can deserialize the entire message at once. When a chunk comes in, we append it to the current readbuf, and then check if we have enough bytes to assemble the length header and it's associated packet. If we do, we deserialize, cut off the bytes, and fire off all the necessary handlers for that packet.
