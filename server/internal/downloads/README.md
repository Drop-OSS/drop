# Drop Download System
The Drop download system uses a torrent-*like* system. It is not torrenting, nor is it compatible with torrenting clients. 

## Clients
Drop clients have built-in HTTP APIs that they forward with UPnP. This API exposes different capabilities for different Drop features, like download aggegration and P2P networking. When they sign on, they send a list of supported capabilities to the server. 