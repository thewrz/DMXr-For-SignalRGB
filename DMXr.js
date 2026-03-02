export function Name() { return "DMXr"; }
export function Version() { return "1.1.0"; }
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
enableDebugLog:readonly
udp:readonly
device:readonly
service:readonly
BIG_ENDIAN:readonly
*/

var serverHost = "127.0.0.1";
var serverPort = "8080";
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
// Magic "DX" | version | flags | seq(2) | timestamp(8) | count | [idx,r,g,b,br]...

var udpSequence = 0;
var udpEnabled = false;

function buildDmxrcPacket(fixtureIndex, r, g, b, brightnessUint8) {
	var seq = udpSequence;
	udpSequence = (udpSequence + 1) & 0xFFFF;

	// Encode timestamp (Date.now()) as float64 BE — 8 bytes
	var ts = Date.now();
	var tsBytes = float64ToBytes(ts);

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
	var tsBytes = float64ToBytes(ts);

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

// Encode a JS number as float64 big-endian (8 bytes)
// Uses DataView trick via a shared ArrayBuffer
var _f64buf = new ArrayBuffer(8);
var _f64view = new DataView(_f64buf);
var _f64bytes = new Uint8Array(_f64buf);

function float64ToBytes(value) {
	_f64view.setFloat64(0, value, false); // false = big-endian
	return [
		_f64bytes[0], _f64bytes[1], _f64bytes[2], _f64bytes[3],
		_f64bytes[4], _f64bytes[5], _f64bytes[6], _f64bytes[7]
	];
}

// --------------------------------<( Per-Controller Lifecycle )>--------------------------------
// SignalRGB calls these with the `controller` global set to the active DMXrBridge instance.

export function Initialize() {
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
			(controller._udpIndex >= 0 ? " [idx=" + controller._udpIndex + "]" : ""));
	}
}

export function Render() {
	var ctrl = controller;

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
	if (udpEnabled && ctrl._udpIndex >= 0 && discoveredHost) {
		var udpPort = discoveredUdpPort || ((parseInt(discoveredPort, 10) || parseInt(serverPort, 10) || 8080) + 1);
		var ip = discoveredHost || serverHost || "127.0.0.1";
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
	var url = getServerUrl("/update/colors");

	var payload = JSON.stringify({
		fixtures: [{
			id: ctrl.id,
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

	// UDP blackout (fire-and-forget, best-effort)
	if (udpEnabled && discoveredHost) {
		try {
			var udpPort = discoveredUdpPort || ((parseInt(discoveredPort, 10) || parseInt(serverPort, 10) || 8080) + 1);
			var ip = discoveredHost || serverHost || "127.0.0.1";
			var packet = buildBlackoutPacket();
			udp.send(ip, udpPort, packet, 1);
		} catch (e) {
			// best-effort
		}
	}

	// HTTP blackout (guaranteed delivery fallback via sync XHR)
	try {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", getServerUrl("/update/colors"), false);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			fixtures: [{ id: ctrl.id, r: 0, g: 0, b: 0, brightness: 0 }],
		}));
	} catch (e) {
		// Server may already be down
	}

	if (enableDebugLog === "true") {
		device.log("DMXr: Shutdown " + ctrl.name);
	}
}

// --------------------------------<( Server URL Helper )>--------------------------------

var discoveredHost = null;
var discoveredPort = null;
var discoveredUdpPort = null;

function getServerUrl(path) {
	if (discoveredHost && discoveredPort) {
		return "http://" + discoveredHost + ":" + discoveredPort + path;
	}

	var host = serverHost || "127.0.0.1";
	var port = parseInt(serverPort, 10) || 8080;

	return "http://" + host + ":" + port + path;
}

// --------------------------------<( Discovery Service )>--------------------------------

export function DiscoveryService() {
	this.IconUrl = "";
	this.MDns = ["_dmxr._tcp.local."];
	this.knownFixtures = {};
	this.pollInterval = 2000;
	this.lastPollTime = 0;

	this.connect = function (devices) {
		for (var i = 0; i < devices.length; i++) {
			var dev = devices[i];

			if (dev.ip && dev.port) {
				discoveredHost = dev.ip;
				discoveredPort = dev.port;

				// Read UDP port from mDNS TXT record
				if (dev.txt && dev.txt.udpPort) {
					discoveredUdpPort = parseInt(dev.txt.udpPort, 10) || null;
				}

				if (enableDebugLog === "true") {
					service.log(
						"DMXr: mDNS discovered server at " + dev.ip + ":" + dev.port +
						(discoveredUdpPort ? " (UDP: " + discoveredUdpPort + ")" : "")
					);
				}

				break;
			}
		}
	};

	this.forceDiscover = function (ipaddress) {
		discoveredHost = ipaddress;
		discoveredPort = parseInt(serverPort, 10) || 8080;
		discoveredUdpPort = null; // will fall back to port+1

		if (enableDebugLog === "true") {
			service.log("DMXr: Manual discover " + ipaddress + ":" + discoveredPort);
		}
	};

	this.removedDevices = function (deviceId) {
		var ctrl = service.getController(deviceId);

		if (ctrl) {
			service.removeController(ctrl);
			delete this.knownFixtures[deviceId];
		}
	};

	this.Update = function () {
		var now = Date.now();

		if (now - this.lastPollTime < this.pollInterval) {
			return;
		}

		this.lastPollTime = now;

		var url = getServerUrl("/fixtures");

		try {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", url, false);
			xhr.send();

			if (xhr.status !== 200) {
				return;
			}

			var serverFixtures = JSON.parse(xhr.responseText);
			var serverIds = {};

			for (var i = 0; i < serverFixtures.length; i++) {
				var fixture = serverFixtures[i];
				serverIds[fixture.id] = true;

				if (!this.knownFixtures[fixture.id]) {
					var bridge = new DMXrBridge(fixture, i);
					service.addController(bridge);
					service.announceController(bridge);
					this.knownFixtures[fixture.id] = fixture;

					if (enableDebugLog === "true") {
						service.log("DMXr: Discovered " + fixture.name + " (id: " + fixture.id + ", udpIdx: " + i + ")");
					}
				} else {
					// Update UDP index in case fixture order changed
					var existingCtrl = service.getController(fixture.id);
					if (existingCtrl) {
						existingCtrl._udpIndex = i;
					}
				}
			}

			// Remove fixtures no longer on server
			for (var id in this.knownFixtures) {
				if (!serverIds[id]) {
					var existing = service.getController(id);

					if (existing) {
						service.removeController(existing);
					}

					delete this.knownFixtures[id];

					if (enableDebugLog === "true") {
						service.log("DMXr: Removed " + id);
					}
				}
			}
		} catch (e) {
			if (enableDebugLog === "true") {
				service.log("DMXr: Poll error - " + e);
			}
		}
	};
}

// --------------------------------<( Bridge Data Class )>--------------------------------
// Data-only object passed to service.addController(). Device operations happen in
// the top-level Initialize/Render/Shutdown exports, not here.

function DMXrBridge(fixture, udpIndex) {
	this.id = fixture.id;
	this.name = fixture.name;
	this.width = 1;
	this.height = 1;

	this.ledNames = [fixture.name];
	this.ledPositions = [[0, 0]];

	this.fixtureConfig = fixture;

	// UDP fixture index (position in server's fixture array)
	this._udpIndex = typeof udpIndex === "number" ? udpIndex : -1;

	// Runtime state (managed by top-level lifecycle exports)
	this._lastR = -1;
	this._lastG = -1;
	this._lastB = -1;
	this._lastSendTime = 0;
}
