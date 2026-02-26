export function Name() { return "DMXr"; }
export function Publisher() { return "DMXr Project"; }
export function Type() { return "network"; }
export function Size() { return [1, 1]; }
export function DefaultPosition() { return [0, 0]; }
export function DefaultScale() { return 8.0; }
export function LedNames() { return ["DMXr"]; }
export function LedPositions() { return [[0, 0]]; }

export function ControllableParameters() {
	return [
		{
			property: "serverPort",
			group: "server",
			label: "Server Port",
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
			default: "false",
		},
	];
}

/** @type {string} */ var serverPort;
/** @type {string} */ var enableDebugLog;

/**
 * Tracks known fixtures from the server and creates/removes controllers to match.
 */
export function DiscoveryService() {
	this.IconUrl = "";
	this.knownFixtures = {};
	this.pollInterval = 2000;
	this.lastPollTime = 0;

	this.connect = function () {
		// Initial poll happens in Update()
	};

	this.removedDevices = function (deviceId) {
		var controller = service.getController(deviceId);

		if (controller) {
			service.removeController(controller);
			delete this.knownFixtures[deviceId];
		}
	};

	this.Update = function () {
		var now = Date.now();

		if (now - this.lastPollTime < this.pollInterval) {
			return;
		}

		this.lastPollTime = now;

		var port = parseInt(serverPort, 10) || 8080;
		var url = "http://127.0.0.1:" + port + "/fixtures";

		try {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", url, false);
			xhr.send();

			if (xhr.status !== 200) {
				return;
			}

			var serverFixtures = JSON.parse(xhr.responseText);
			var serverIds = {};

			// Add new fixtures
			for (var i = 0; i < serverFixtures.length; i++) {
				var fixture = serverFixtures[i];
				serverIds[fixture.id] = true;

				if (!this.knownFixtures[fixture.id]) {
					var controller = new DMXrController(fixture);
					service.addController(controller);
					this.knownFixtures[fixture.id] = fixture;

					if (enableDebugLog === "true") {
						device.log("DMXr: Added fixture " + fixture.name + " (id: " + fixture.id + ")");
					}
				}
			}

			// Remove fixtures no longer on server
			for (var id in this.knownFixtures) {
				if (!serverIds[id]) {
					var ctrl = service.getController(id);

					if (ctrl) {
						service.removeController(ctrl);
					}

					delete this.knownFixtures[id];

					if (enableDebugLog === "true") {
						device.log("DMXr: Removed fixture " + id);
					}
				}
			}
		} catch (e) {
			if (enableDebugLog === "true") {
				device.log("DMXr: Poll error - " + e);
			}
		}
	};
}

/**
 * One controller per fixture. Each becomes a draggable subdevice in SignalRGB.
 */
function DMXrController(fixture) {
	this.id = fixture.id;
	this.name = fixture.name;
	this.width = 1;
	this.height = 1;
	this.ledNames = [fixture.name];
	this.ledPositions = [[0, 0]];

	this.fixtureConfig = fixture;
	this.lastR = -1;
	this.lastG = -1;
	this.lastB = -1;
	this.lastBrightness = -1;
	this.pendingXhr = null;
	this.lastSendTime = 0;

	var MIN_SEND_INTERVAL_MS = 16; // ~60 Hz max

	this.Initialize = function () {
		this.lastR = -1;
		this.lastG = -1;
		this.lastB = -1;
		this.lastBrightness = -1;
		this.pendingXhr = null;
		this.lastSendTime = 0;

		device.createSubdevice(this.id);
		device.setSubdeviceName(this.id, fixture.name);
		device.setSubdeviceSize(this.id, 1, 1);
		device.setSubdeviceLeds(this.id, [fixture.name], [[0, 0]]);

		if (enableDebugLog === "true") {
			device.log("DMXr: Initialized subdevice for " + fixture.name);
		}
	};

	this.Render = function () {
		var now = Date.now();

		if (now - this.lastSendTime < MIN_SEND_INTERVAL_MS) {
			return;
		}

		var color = device.subdeviceColor(this.id, 0, 0);
		var r = color[0];
		var g = color[1];
		var b = color[2];
		var brightness = device.getBrightness();

		if (
			r === this.lastR &&
			g === this.lastG &&
			b === this.lastB &&
			brightness === this.lastBrightness
		) {
			return;
		}

		this.lastR = r;
		this.lastG = g;
		this.lastB = b;
		this.lastBrightness = brightness;

		var payload = JSON.stringify({
			fixtures: [
				{
					id: this.id,
					r: r,
					g: g,
					b: b,
					brightness: brightness,
				},
			],
		});

		var port = parseInt(serverPort, 10) || 8080;
		var url = "http://127.0.0.1:" + port + "/update/colors";

		if (this.pendingXhr !== null) {
			try {
				this.pendingXhr.abort();
			} catch (e) {
				// ignore abort errors
			}
		}

		try {
			var xhr = new XMLHttpRequest();
			xhr.open("POST", url, true);
			xhr.setRequestHeader("Content-Type", "application/json");
			this.pendingXhr = xhr;

			var self = this;

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					self.pendingXhr = null;

					if (enableDebugLog === "true" && xhr.status !== 200) {
						device.log(
							"DMXr: HTTP " + xhr.status + " - " + xhr.responseText
						);
					}
				}
			};

			xhr.send(payload);
			this.lastSendTime = now;

			if (enableDebugLog === "true") {
				device.log(
					"DMXr: " + this.name +
					" R:" + r +
					" G:" + g +
					" B:" + b +
					" Br:" + brightness.toFixed(2)
				);
			}
		} catch (e) {
			if (enableDebugLog === "true") {
				device.log("DMXr: Send error - " + e);
			}
		}
	};

	this.Shutdown = function () {
		if (this.pendingXhr !== null) {
			try {
				this.pendingXhr.abort();
			} catch (e) {
				// ignore
			}

			this.pendingXhr = null;
		}

		// Best-effort blackout for this fixture
		try {
			var xhr = new XMLHttpRequest();
			var port = parseInt(serverPort, 10) || 8080;
			xhr.open("POST", "http://127.0.0.1:" + port + "/update/colors", false);
			xhr.setRequestHeader("Content-Type", "application/json");
			xhr.send(JSON.stringify({
				fixtures: [{ id: this.id, r: 0, g: 0, b: 0, brightness: 0 }],
			}));
		} catch (e) {
			// Server may already be down
		}

		try {
			device.removeSubdevice(this.id);
		} catch (e) {
			// ignore
		}

		if (enableDebugLog === "true") {
			device.log("DMXr: Shutdown " + this.name);
		}
	};
}
