# mdns/ — mDNS Service Advertisement

## advertiser.ts

- `createMdnsAdvertiser(options)` -> `MdnsAdvertiser { unpublishAll, republish }`
- Advertises `_dmxr._tcp` service via `bonjour-service` (multicast DNS)
- TXT record includes: version, serverId, serverName, udpPort, path="/fixtures"
- Uses `reuseAddr: true` to avoid socket conflicts with other mDNS services

## Republish Debounce

When settings change (name, port), `republish()` debounces by 2 seconds to
avoid flooding the network with rapid advertisement changes. It stops the
active service, then re-publishes with updated options.

## Storm Mitigation

SignalRGB v2.5.51 opens one mDNS socket per installed addon, creating an
mDNS storm on the local network. The `reuseAddr` flag and `probe: false`
setting minimize DMXr's contribution to this issue. See the project memory
file `mdns-investigation.md` for the full root-cause analysis.

## Lifecycle

- Created after HTTP + UDP listeners are bound (needs final port numbers)
- `unpublishAll()` called during shutdown to deregister the service
- Only created when `config.mdnsEnabled` is true
