# Drop Download System
Drop downloads come in two types:

## Public (not quite) HTTPS downloads endpoints
These use public HTTPS certificate, and while are authenticated, are 'public' in the sense that they aren't P2P; anyone can connect to them

## Private mTLS P2P endpoints
Drop clients use P2P mTLS aided by the P2P co-ordinator to transfer chunks between themselves. 