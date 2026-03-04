function dmxrSettings() {
  return {
    showSettings: false,
    settingsLoading: false,
    settingsError: "",
    settingsSaved: false,

    // Settings form
    settingsServerName: "",
    settingsDriver: "null",
    settingsDevicePath: "auto",
    settingsPort: 8080,
    settingsUdpPort: 0,
    settingsHost: "0.0.0.0",
    settingsMdns: true,
    settingsSetupCompleted: false,

    // Available ports
    availablePorts: [],
    portsScanning: false,
    serverVersion: "",

    // Restart state
    requiresRestart: false,
    restarting: false,

    async loadSettings() {
      this.settingsLoading = true;
      this.settingsError = "";
      try {
        var res = await fetch("/settings");
        if (!res.ok) {
          if (res.status === 403) {
            this.settingsError = "Settings can only be changed from localhost.";
          } else {
            this.settingsError = "Failed to load settings (HTTP " + res.status + ")";
          }
          return;
        }
        var data = await res.json();
        var s = data.settings;
        this.settingsServerName = s.serverName || "";
        this.settingsDriver = s.dmxDriver;
        this.settingsDevicePath = s.dmxDevicePath;
        this.settingsPort = s.port;
        this.settingsUdpPort = s.udpPort || 0;
        this.settingsHost = s.host;
        this.settingsMdns = s.mdnsEnabled;
        this.settingsSetupCompleted = s.setupCompleted;
        this.availablePorts = data.availablePorts || [];
        this.serverVersion = data.serverVersion || "";
        this.requiresRestart = false;
      } catch (e) {
        this.settingsError = "Could not connect to server.";
      } finally {
        this.settingsLoading = false;
      }
    },

    async saveSettings() {
      this.settingsError = "";
      this.settingsSaved = false;
      try {
        var res = await fetch("/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serverName: this.settingsServerName,
            dmxDriver: this.settingsDriver,
            dmxDevicePath: this.settingsDevicePath,
            port: this.settingsPort,
            udpPort: this.settingsUdpPort,
            host: this.settingsHost,
            mdnsEnabled: this.settingsMdns,
          }),
        });
        if (!res.ok) {
          this.settingsError = "Failed to save settings (HTTP " + res.status + ")";
          return;
        }
        var data = await res.json();
        this.requiresRestart = data.requiresRestart;
        this.settingsSaved = true;
        setTimeout(function () {
          this.settingsSaved = false;
        }.bind(this), 3000);
      } catch (e) {
        this.settingsError = "Could not save settings.";
      }
    },

    async scanPorts() {
      this.portsScanning = true;
      try {
        var res = await fetch("/settings/scan-ports", { method: "POST" });
        if (res.ok) {
          var data = await res.json();
          this.availablePorts = data.ports || [];
          if (data.recommended && this.settingsDevicePath === "auto") {
            this.settingsDevicePath = data.recommended;
          }
        }
      } catch (e) {
        // silent
      } finally {
        this.portsScanning = false;
      }
    },

    async restartServer() {
      this.restarting = true;
      try {
        await fetch("/settings/restart", { method: "POST" });
      } catch (e) {
        // expected — server exits
      }
      // Poll for server to come back
      var attempts = 0;
      var poll = setInterval(async function () {
        attempts++;
        if (attempts > 20) {
          clearInterval(poll);
          this.restarting = false;
          this.settingsError = "Server did not come back after restart.";
          return;
        }
        try {
          var res = await fetch("/health");
          if (res.ok) {
            clearInterval(poll);
            this.restarting = false;
            this.requiresRestart = false;
            await this.loadSettings();
            await this.loadFixtures();
          }
        } catch (e) {
          // still restarting
        }
      }.bind(this), 2000);
    },

    async loadServerName() {
      try {
        var res = await fetch("/settings");
        if (res.ok) {
          var data = await res.json();
          this.settingsServerName = data.settings.serverName || "";
        }
      } catch {
        // ignore
      }
    },

    openSettings() {
      this.showSettings = true;
      this.loadSettings();
    },

    closeSettings() {
      this.showSettings = false;
    },

    getPortLabel(port) {
      var label = port.path;
      if (port.manufacturer) label += " (" + port.manufacturer + ")";
      if (port.isEnttec) label += " — ENTTEC";
      return label;
    },
  };
}
