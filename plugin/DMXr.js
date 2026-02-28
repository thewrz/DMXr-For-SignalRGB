export function Name() { return "DMXr"; }
export function Version() { return "1.0.0"; }
export function Type() { return "network"; }
export function Publisher() { return "DMXr Project"; }
export function Size() { return [1, 1]; }
export function DefaultPosition() { return [0, 0]; }
export function DefaultScale() { return 8.0; }
export function SubdeviceController() { return true; }
export function DefaultComponentBrand() { return "DMXr"; }

/* global
controller:readonly
discovery:readonly
serverHost:readonly
serverPort:readonly
enableDebugLog:readonly
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

// --------------------------------<( Per-Controller Lifecycle )>--------------------------------
// SignalRGB calls these with the `controller` global set to the active DMXrBridge instance.

export function Initialize() {
	device.setName(controller.name);

	device.SetLedLimit(1);
	device.addChannel(controller.name, 1);

	controller._lastR = -1;
	controller._lastG = -1;
	controller._lastB = -1;
	controller._lastSendTime = 0;
	controller._diagDone = false;

	if (enableDebugLog === "true") {
		device.log("DMXr: Initialized " + controller.name);
	}
}

export function Render() {
	var ctrl = controller;

	// Single pixel color sample from the canvas tile
	var color = device.color(0, 0);

	if (!color || color.length < 3) {
		return;
	}

	// One-time diagnostic: dump raw color data to determine channel order
	if (!ctrl._diagDone && enableDebugLog === "true") {
		ctrl._diagDone = true;
		device.log("DIAG " + ctrl.name + " typeof=" + typeof color + " length=" + color.length);
		device.log("DIAG " + ctrl.name + " indices [0]=" + color[0] + " [1]=" + color[1] + " [2]=" + color[2]);

		if (color.r !== undefined) {
			device.log("DIAG " + ctrl.name + " named .r=" + color.r + " .g=" + color.g + " .b=" + color.b);
		} else {
			device.log("DIAG " + ctrl.name + " no named .r/.g/.b properties");
		}
	}

	var r = color[0];
	var g = color[1];
	var b = color[2];

	// Throttle to ~60 Hz
	var now = Date.now();

	if (ctrl._lastSendTime && now - ctrl._lastSendTime < 16) {
		return;
	}

	// Force re-send every 5 seconds to resync after blackout/resume/server restart
	if (ctrl._lastSendTime && now - ctrl._lastSendTime > 5000) {
		ctrl._lastR = -1;
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
		xhr.open("POST", url, false);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(payload);

		if (enableDebugLog === "true") {
			if (xhr.status !== 200) {
				device.log("DMXr: HTTP " + xhr.status + " - " + xhr.responseText);
			} else {
				device.log(
					"DMXr: " + ctrl.name +
					" R:" + r + " G:" + g + " B:" + b +
					" Br:" + brightness.toFixed(2)
				);
			}
		}
	} catch (e) {
		if (enableDebugLog === "true") {
			device.log("DMXr: Send error - " + e);
		}
	}
}

export function Shutdown() {
	var ctrl = controller;

	// Best-effort per-fixture blackout
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

	// Fallback: full blackout (all 512 channels → 0) regardless of fixture store
	try {
		var xhrBlackout = new XMLHttpRequest();
		xhrBlackout.open("POST", getServerUrl("/control/blackout"), false);
		xhrBlackout.send();
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

				if (enableDebugLog === "true") {
					service.log("DMXr: mDNS discovered server at " + dev.ip + ":" + dev.port);
				}

				break;
			}
		}
	};

	this.forceDiscover = function (ipaddress) {
		discoveredHost = ipaddress;
		discoveredPort = parseInt(serverPort, 10) || 8080;

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
					var bridge = new DMXrBridge(fixture);
					service.addController(bridge);
					service.announceController(bridge);
					this.knownFixtures[fixture.id] = fixture;

					if (enableDebugLog === "true") {
						service.log("DMXr: Discovered " + fixture.name + " (id: " + fixture.id + ")");
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

function DMXrBridge(fixture) {
	this.id = fixture.id;
	this.name = fixture.name;
	this.width = 1;
	this.height = 1;

	this.ledNames = [fixture.name];
	this.ledPositions = [[0, 0]];

	this.fixtureConfig = fixture;

	// Runtime state (managed by top-level lifecycle exports)
	this._lastR = -1;
	this._lastG = -1;
	this._lastB = -1;
	this._lastSendTime = 0;
	this._diagDone = false;
}
