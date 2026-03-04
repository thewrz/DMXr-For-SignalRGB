export function Name() { return "DMXr"; }
export function Version() { return "1.2.0"; }
export function Type() { return "network"; }
export function Publisher() { return "DMXr Project"; }
export function Size() { return [1, 1]; }
export function DefaultPosition() { return [0, 0]; }
export function DefaultScale() { return 8.0; }
export function SubdeviceController() { return false; }

/* global
controller:readonly
discovery:readonly
serverHost:readonly
serverPort:readonly
additionalServers:readonly
enableDebugLog:readonly
udp:readonly
device:readonly
service:readonly
BIG_ENDIAN:readonly
*/

var serverHost = "127.0.0.1";
var serverPort = "8080";
var additionalServers = "";
var enableDebugLog = "true";

export function ControllableParameters() {
	return [
		{
			property: "serverHost",
			group: "server",
			label: "Server Host (manual fallback)",
			type: "textfield",
			default: "127.0.0.1",
		},
		{
			property: "serverPort",
			group: "server",
			label: "Server Port (manual fallback)",
			type: "number",
			min: "1024",
			max: "65535",
			default: "8080",
		},
		{
			property: "additionalServers",
			group: "server",
			label: "Additional Servers (ip:port, comma-separated)",
			type: "textfield",
			default: "",
		},
		{
			property: "enableDebugLog",
			group: "debug",
			label: "Enable Debug Log",
			type: "boolean",
			default: "true",
		},
	];
}

// --------------------------------<( UDP Protocol )>--------------------------------
// DMXRC binary protocol: 15-byte header + 5 bytes per fixture
// Magic "DX" | version | flags | seq(2) | timestamp uint64 BE(8) | count | [idx,r,g,b,br]...

var udpSequence = 0;
var udpEnabled = false;

function buildDmxrcPacket(fixtureIndex, r, g, b, brightnessUint8) {
	var seq = udpSequence;
	udpSequence = (udpSequence + 1) & 0xFFFF;

	// Encode timestamp (Date.now()) as uint64 BE — 8 bytes
	var ts = Date.now();
	var tsBytes = timestampToBytes(ts);

	var packet = [
		0x44, 0x58,                 // magic "DX"
		0x01,                       // version
		0x00,                       // flags (no ping, no blackout)
		(seq >> 8) & 0xFF,          // sequence high
		seq & 0xFF,                 // sequence low
		tsBytes[0], tsBytes[1], tsBytes[2], tsBytes[3],  // timestamp bytes 0-3
		tsBytes[4], tsBytes[5], tsBytes[6], tsBytes[7],  // timestamp bytes 4-7
		1,                          // fixture_count
		fixtureIndex,               // fixture index
		r, g, b,                    // RGB
		brightnessUint8             // brightness as uint8
	];

	return packet;
}

function buildBlackoutPacket() {
	var seq = udpSequence;
	udpSequence = (udpSequence + 1) & 0xFFFF;

	var ts = Date.now();
	var tsBytes = timestampToBytes(ts);

	return [
		0x44, 0x58,
		0x01,
		0x02,                       // FLAG_BLACKOUT
		(seq >> 8) & 0xFF,
		seq & 0xFF,
		tsBytes[0], tsBytes[1], tsBytes[2], tsBytes[3],
		tsBytes[4], tsBytes[5], tsBytes[6], tsBytes[7],
		0                           // zero fixtures
	];
}

// Encode a JS timestamp (Date.now()) as uint64 big-endian (8 bytes)
// Uses only basic integer math — no typed arrays (SignalRGB sandbox lacks them)
function timestampToBytes(ms) {
	var bytes = [0, 0, 0, 0, 0, 0, 0, 0];
	for (var i = 7; i >= 0; i--) {
		bytes[i] = ms & 0xFF;
		ms = Math.floor(ms / 256);
	}
	return bytes;
}

// --------------------------------<( Server Registry )>--------------------------------
// Multi-server support: tracks all discovered DMXr servers keyed by serverId

var serverRegistry = {};
// serverRegistry[serverId] = { serverId, serverName, host, port, udpPort, lastSeen, healthy }

var STALE_TIMEOUT_MS = 30000; // prune servers not seen in 30s

function getServerUrlFor(server, path) {
	return "http://" + server.host + ":" + server.port + path;
}

// Fallback: first healthy server, or manual config
function getServerUrl(path) {
	var keys = Object.keys(serverRegistry);
	for (var i = 0; i < keys.length; i++) {
		var srv = serverRegistry[keys[i]];
		if (srv.healthy) {
			return getServerUrlFor(srv, path);
		}
	}

	var host = serverHost || "127.0.0.1";
	var port = parseInt(serverPort, 10) || 8080;
	return "http://" + host + ":" + port + path;
}

// --------------------------------<( Per-Controller Lifecycle )>--------------------------------
// SignalRGB calls these with the `controller` global set to the active DMXrBridge instance.

export function Initialize() {
	device.log("DMXr: Initialize v1.2.0");
	device.setName(controller.name);

	device.setSize([1, 1]);
	device.setControllableLeds([controller.name], [[0, 0]]);

	// Enable UDP transport
	try {
		device.addFeature("udp");
		udpEnabled = true;
	} catch (e) {
		udpEnabled = false;
		if (enableDebugLog === "true") {
			device.log("DMXr: UDP not available, using HTTP fallback");
		}
	}

	controller._lastR = -1;
	controller._lastG = -1;
	controller._lastB = -1;
	controller._lastSendTime = 0;

	if (enableDebugLog === "true") {
		device.log("DMXr: Initialized " + controller.name +
			(udpEnabled ? " (UDP)" : " (HTTP)") +
			(controller._udpIndex >= 0 ? " [idx=" + controller._udpIndex + "]" : "") +
			" -> " + controller._server.host + ":" + controller._server.port);
	}
}

export function Render() {
	var ctrl = controller;
	var srv = ctrl._server;

	// Single pixel color sample from the canvas tile
	var color = device.color(0, 0);
	var r = color[0];
	var g = color[1];
	var b = color[2];

	// Throttle to ~60 Hz
	var now = Date.now();

	if (ctrl._lastSendTime && now - ctrl._lastSendTime < 16) {
		return;
	}

	// Skip if unchanged
	if (r === ctrl._lastR && g === ctrl._lastG && b === ctrl._lastB) {
		return;
	}

	ctrl._lastR = r;
	ctrl._lastG = g;
	ctrl._lastB = b;
	ctrl._lastSendTime = now;

	var brightness = device.getBrightness() / 100;

	// UDP fast path: binary DMXRC packet
	if (udpEnabled && ctrl._udpIndex >= 0) {
		var udpPort = srv.udpPort || (srv.port + 1);
		var ip = srv.host;
		var brightnessUint8 = Math.round(brightness * 255);
		var packet = buildDmxrcPacket(ctrl._udpIndex, r, g, b, brightnessUint8);

		try {
			udp.send(ip, udpPort, packet, 1); // BIG_ENDIAN = 1
		} catch (e) {
			if (enableDebugLog === "true") {
				device.log("DMXr: UDP send error - " + e);
			}
		}

		return;
	}

	// HTTP fallback
	var url = getServerUrlFor(srv, "/update/colors");

	var payload = JSON.stringify({
		fixtures: [{
			id: ctrl._fixtureId,
			r: r,
			g: g,
			b: b,
			brightness: brightness,
		}],
	});

	try {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", url, true); // async=true (non-blocking fallback)
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(payload);

		if (enableDebugLog === "true") {
			device.log(
				"DMXr: " + ctrl.name +
				" R:" + r + " G:" + g + " B:" + b +
				" Br:" + brightness.toFixed(2) + " (HTTP)"
			);
		}
	} catch (e) {
		if (enableDebugLog === "true") {
			device.log("DMXr: Send error - " + e);
		}
	}
}

export function Shutdown() {
	var ctrl = controller;
	var srv = ctrl._server;

	// UDP blackout (fire-and-forget, best-effort)
	if (udpEnabled) {
		try {
			var udpPort = srv.udpPort || (srv.port + 1);
			var ip = srv.host;
			var packet = buildBlackoutPacket();
			udp.send(ip, udpPort, packet, 1);
		} catch (e) {
			// best-effort
		}
	}

	// HTTP blackout (guaranteed delivery fallback via sync XHR)
	try {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", getServerUrlFor(srv, "/update/colors"), false);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			fixtures: [{ id: ctrl._fixtureId, r: 0, g: 0, b: 0, brightness: 0 }],
		}));
	} catch (e) {
		// Server may already be down
	}

	if (enableDebugLog === "true") {
		device.log("DMXr: Shutdown " + ctrl.name);
	}
}

// --------------------------------<( Discovery Service )>--------------------------------

export function DiscoveryService() {
	this.IconUrl = "https://raw.githubusercontent.com/thewrz/DMXr/main/DMXr-logo-square.png";
	this.MDns = ["_dmxr._tcp.local."];
	this.knownFixtures = {};
	this.pollInterval = 2000;
	this.lastPollTime = 0;

	this.connect = function (devices) {
		for (var i = 0; i < devices.length; i++) {
			var dev = devices[i];

			if (!dev.ip || !dev.port) {
				continue;
			}

			// Determine server identity — prefer TXT serverId, fall back to ip:port
			var sid = (dev.txt && dev.txt.serverId) ? dev.txt.serverId : (dev.ip + ":" + dev.port);
			var sname = (dev.txt && dev.txt.serverName) ? dev.txt.serverName : "";
			var udpPort = (dev.txt && dev.txt.udpPort) ? (parseInt(dev.txt.udpPort, 10) || null) : null;

			serverRegistry[sid] = {
				serverId: sid,
				serverName: sname,
				host: dev.ip,
				port: dev.port,
				udpPort: udpPort,
				lastSeen: Date.now(),
				healthy: true,
			};

			if (enableDebugLog === "true") {
				service.log(
					"DMXr: mDNS discovered server " + (sname || sid.slice(0, 8)) +
					" at " + dev.ip + ":" + dev.port +
					(udpPort ? " (UDP: " + udpPort + ")" : "")
				);
			}
		}
	};

	this.forceDiscover = function (ipaddress) {
		var port = parseInt(serverPort, 10) || 8080;
		var sid = ipaddress + ":" + port;

		serverRegistry[sid] = {
			serverId: sid,
			serverName: "",
			host: ipaddress,
			port: port,
			udpPort: null,
			lastSeen: Date.now(),
			healthy: true,
		};

		if (enableDebugLog === "true") {
			service.log("DMXr: Manual discover " + ipaddress + ":" + port);
		}
	};

	this.removedDevices = function (deviceId) {
		var ctrl = service.getController(deviceId);

		if (ctrl) {
			service.removeController(ctrl);
			delete this.knownFixtures[deviceId];
		}
	};

	var self = this;

	this.Update = function () {
		var now = Date.now();

		if (now - self.lastPollTime < self.pollInterval) {
			return;
		}

		self.lastPollTime = now;

		// Prune stale servers
		var serverKeys = Object.keys(serverRegistry);
		for (var s = 0; s < serverKeys.length; s++) {
			var srv = serverRegistry[serverKeys[s]];
			if (now - srv.lastSeen > STALE_TIMEOUT_MS) {
				// Remove all fixtures belonging to this server
				for (var fid in self.knownFixtures) {
					if (self.knownFixtures[fid] === srv.serverId) {
						var existingCtrl = service.getController(fid);
						if (existingCtrl) {
							service.removeController(existingCtrl);
						}
						delete self.knownFixtures[fid];

						if (enableDebugLog === "true") {
							service.log("DMXr: Removed " + fid + " (server gone)");
						}
					}
				}
				delete serverRegistry[serverKeys[s]];

				if (enableDebugLog === "true") {
					service.log("DMXr: Pruned stale server " + serverKeys[s]);
				}
			}
		}

		// Always probe the manual host:port — this is the primary fallback
		// when mDNS doesn't work (VMs, firewalls, no Bonjour on Windows).
		// probeManualServer() uses /health to learn the real serverId so it
		// deduplicates naturally if mDNS also discovers the same server.
		probeManualServer();

		// Poll each server
		serverKeys = Object.keys(serverRegistry);
		for (var k = 0; k < serverKeys.length; k++) {
			pollServerFixtures(self, serverRegistry[serverKeys[k]]);
		}

		// Serialize registry snapshot for QML settings panel consumption
		try {
			var snapshot = {};
			var skeys = Object.keys(serverRegistry);
			for (var r = 0; r < skeys.length; r++) {
				var entry = serverRegistry[skeys[r]];
				snapshot[skeys[r]] = {
					serverId: entry.serverId,
					serverName: entry.serverName,
					host: entry.host,
					port: entry.port,
					udpPort: entry.udpPort,
					healthy: entry.healthy,
					fixtureCount: entry.fixtureCount || 0,
				};
			}
			service.saveSetting("DMXr", "serverRegistry", JSON.stringify(snapshot));
		} catch (e) { /* saveSetting may not exist in all JS contexts */ }
	};
}

function pollServerFixtures(disco, server) {
	var url = getServerUrlFor(server, "/fixtures");

	try {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, false);
		xhr.send();

		if (xhr.status !== 200) {
			server.healthy = false;
			return;
		}

		server.healthy = true;
		server.lastSeen = Date.now();

		// Update registry if this server was a fallback
		if (!serverRegistry[server.serverId]) {
			serverRegistry[server.serverId] = server;
		}

		var serverFixtures = JSON.parse(xhr.responseText);
		server.fixtureCount = serverFixtures.length;

		// Collect all fixture names across all servers for collision detection
		var nameCountMap = buildNameCountMap(serverFixtures, server.serverId);

		var serverIds = {};

		for (var i = 0; i < serverFixtures.length; i++) {
			var fixture = serverFixtures[i];
			var namespacedId = server.serverId + "/" + fixture.id;
			serverIds[namespacedId] = true;

			if (!disco.knownFixtures[namespacedId]) {
				// Check if another server has a fixture with the same name
				var displayName = fixture.name;
				if (nameCountMap[fixture.name] > 1 && server.serverName) {
					displayName = fixture.name + " (" + server.serverName + ")";
				}

				var bridge = new DMXrBridge(fixture, i, server, displayName);
				service.addController(bridge);
				service.announceController(bridge);
				disco.knownFixtures[namespacedId] = server.serverId;

				if (enableDebugLog === "true") {
					service.log("DMXr: Discovered " + displayName +
						" (id: " + namespacedId + ", udpIdx: " + i +
						", server: " + (server.serverName || server.serverId.slice(0, 8)) + ")");
				}
			} else {
				// Update UDP index in case fixture order changed
				var existingCtrl = service.getController(namespacedId);
				if (existingCtrl) {
					existingCtrl._udpIndex = i;
				}
			}
		}

		// Remove fixtures no longer on this server
		for (var id in disco.knownFixtures) {
			if (disco.knownFixtures[id] === server.serverId && !serverIds[id]) {
				var existing = service.getController(id);

				if (existing) {
					service.removeController(existing);
				}

				delete disco.knownFixtures[id];

				if (enableDebugLog === "true") {
					service.log("DMXr: Removed " + id);
				}
			}
		}
	} catch (e) {
		server.healthy = false;

		if (enableDebugLog === "true") {
			service.log("DMXr: Poll error for " +
				(server.serverName || server.serverId.slice(0, 8)) + " - " + e);
		}
	}
}

// Build a map of fixture name -> count across all servers for collision detection
function buildNameCountMap(currentFixtures, currentServerId) {
	var counts = {};

	// Count names from other servers' known fixtures
	var allKeys = Object.keys(serverRegistry);
	for (var s = 0; s < allKeys.length; s++) {
		var sid = allKeys[s];
		if (sid === currentServerId) continue;

		// Check existing controllers for name collisions
		for (var fid in serverRegistry) {
			// We only know names of fixtures we've already discovered
			var ctrl = service.getController(sid + "/" + fid);
			if (ctrl) {
				var baseName = ctrl.fixtureConfig ? ctrl.fixtureConfig.name : ctrl.name;
				counts[baseName] = (counts[baseName] || 0) + 1;
			}
		}
	}

	// Count names from current server's fixtures
	for (var i = 0; i < currentFixtures.length; i++) {
		var name = currentFixtures[i].name;
		counts[name] = (counts[name] || 0) + 1;
	}

	return counts;
}

// --------------------------------<( Manual Server Probe )>--------------------------------
// Probes the manual serverHost:serverPort via /health to learn its real serverId.
// This is the fallback when mDNS doesn't work (Windows without Bonjour, VMs, etc.).
// If the server is already in the registry (found via mDNS), this is a no-op.

function probeManualServer() {
	// Build list of host:port pairs to probe
	var targets = [];
	var seen = {};

	// Helper: add target if not already in list
	function addTarget(h, p) {
		var key = h + ":" + p;
		if (!seen[key]) {
			seen[key] = true;
			targets.push({ host: h, port: p });
		}
	}

	// Primary manual server (ControllableParameter)
	var host = serverHost || "127.0.0.1";
	var port = parseInt(serverPort, 10) || 8080;
	addTarget(host, port);

	// QML-saved settings (service.saveSetting store) — the QML panel saves
	// serverHost/serverPort separately from ControllableParameters
	try {
		var qmlHost = service.getSetting("DMXr", "serverHost");
		var qmlPort = service.getSetting("DMXr", "serverPort");
		if (qmlHost && qmlHost !== "") {
			var qp = parseInt(qmlPort, 10) || 8080;
			addTarget(qmlHost, qp);
		}
	} catch (e) {
		// service.getSetting may not be available in all contexts
	}

	// Additional servers (comma-separated "ip:port" entries)
	if (additionalServers) {
		var parts = additionalServers.split(",");
		for (var p = 0; p < parts.length; p++) {
			var entry = parts[p].replace(/\s/g, "");
			if (!entry) continue;
			var colonIdx = entry.lastIndexOf(":");
			if (colonIdx > 0) {
				var aHost = entry.substring(0, colonIdx);
				var aPort = parseInt(entry.substring(colonIdx + 1), 10);
				if (aHost && aPort > 0) {
					addTarget(aHost, aPort);
				}
			} else {
				// Bare IP — use default port
				addTarget(entry, 8080);
			}
		}
	}

	for (var t = 0; t < targets.length; t++) {
		probeOneServer(targets[t].host, targets[t].port);
	}
}

function probeOneServer(host, port) {
	// Skip if this exact host:port is already tracked by a healthy server
	var keys = Object.keys(serverRegistry);
	for (var i = 0; i < keys.length; i++) {
		var existing = serverRegistry[keys[i]];
		if (existing.host === host && existing.port === port && existing.healthy) {
			return;
		}
	}

	try {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "http://" + host + ":" + port + "/health", false);
		xhr.send();

		if (xhr.status !== 200) {
			return;
		}

		var health = JSON.parse(xhr.responseText);
		var sid = health.serverId || (host + ":" + port);

		// Don't overwrite an mDNS-discovered entry that has a different address
		if (serverRegistry[sid] && serverRegistry[sid].healthy) {
			return;
		}

		serverRegistry[sid] = {
			serverId: sid,
			serverName: health.serverName || "",
			host: host,
			port: port,
			udpPort: health.udpPort || null,
			lastSeen: Date.now(),
			healthy: true,
		};

		if (enableDebugLog === "true") {
			service.log("DMXr: Manual probe found server " +
				(health.serverName || sid.slice(0, 8)) +
				" at " + host + ":" + port);
		}
	} catch (e) {
		// Server unreachable — that's fine, mDNS may find others
	}
}

// --------------------------------<( Bridge Data Class )>--------------------------------
// Data-only object passed to service.addController(). Device operations happen in
// the top-level Initialize/Render/Shutdown exports, not here.

function DMXrBridge(fixture, udpIndex, server, displayName) {
	this.id = server.serverId + "/" + fixture.id;
	this.name = displayName || fixture.name;
	this.width = 1;
	this.height = 1;

	this.ledNames = [this.name];
	this.ledPositions = [[0, 0]];

	this.fixtureConfig = fixture;

	// Original fixture ID for API calls (not namespaced)
	this._fixtureId = fixture.id;

	// Reference to the server registry entry for routing
	this._server = server;

	// UDP fixture index (position in server's fixture array)
	this._udpIndex = typeof udpIndex === "number" ? udpIndex : -1;

	// Runtime state (managed by top-level lifecycle exports)
	this._lastR = -1;
	this._lastG = -1;
	this._lastB = -1;
	this._lastSendTime = 0;
}
