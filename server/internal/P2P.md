# Drop P2P System

Drop clients have a variety of P2P or P2P-like methods of data transfer available

## Public (not quite) HTTPS downloads endpoints

These use public HTTPS certificate, and while are authenticated, are 'public' in the sense that they aren't P2P; anyone can connect to them

## Private mTLS P2P endpoints

Drop clients use P2P mTLS aided by the P2P co-ordinator to transfer chunks between themselves. This happens over HTTP.

## Private mTLS Wireguard tunnels

Drop clients can establish P2P Wireguard
