Vendored protobuf definitions for the Ubisoft Connect "demux" socket protocol,
from YoobieRE/ubisoft-demux-node (MIT, npm package "ubisoft-demux"); download.proto (install-manifest schema) from claabs/uplay-install-reverse.

Upstream layout preserved: demux.proto, ownership.proto and
download_service.proto import nothing, so they are drop-in files.
Used by server/utils/ubisoft/demux/ - generated code lands in
server/internal/proto/ubisoft-demux/ via "buf generate".
