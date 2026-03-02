function dmxrSetupWizard() {
  return {
    wizardStep: 1,
    wizardVisible: false,
    wizardDriver: "null",
    wizardDevicePath: "auto",
    wizardPorts: [],
    wizardScanning: false,
    wizardError: "",

    async checkWizardNeeded() {
      try {
        var res = await fetch("/settings");
        if (!res.ok) return;
        var data = await res.json();
        if (!data.settings.setupCompleted) {
          this.wizardVisible = true;
          this.wizardPorts = data.availablePorts || [];
          this.autoSelectEnttec();
        }
      } catch (e) {
        // server may not support settings yet
      }
    },

    autoSelectEnttec() {
      var enttec = this.wizardPorts.find(function (p) { return p.isEnttec; });
      if (enttec) {
        this.wizardDriver = "enttec-usb-dmx-pro";
        this.wizardDevicePath = enttec.path;
      }
    },

    async wizardScanPorts() {
      this.wizardScanning = true;
      try {
        var res = await fetch("/settings/scan-ports", { method: "POST" });
        if (res.ok) {
          var data = await res.json();
          this.wizardPorts = data.ports || [];
          this.autoSelectEnttec();
        }
      } catch (e) {
        // silent
      } finally {
        this.wizardScanning = false;
      }
    },

    wizardNext() {
      if (this.wizardStep < 3) {
        this.wizardStep++;
      }
    },

    wizardBack() {
      if (this.wizardStep > 1) {
        this.wizardStep--;
      }
    },

    async wizardFinish() {
      this.wizardError = "";
      try {
        var res = await fetch("/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dmxDriver: this.wizardDriver,
            dmxDevicePath: this.wizardDevicePath,
            setupCompleted: true,
          }),
        });
        if (!res.ok) {
          this.wizardError = "Failed to save settings.";
          return;
        }
        var data = await res.json();
        this.wizardVisible = false;
        if (data.requiresRestart) {
          await this.restartServer();
        }
      } catch (e) {
        this.wizardError = "Could not connect to server.";
      }
    },

    getWizardPortLabel(port) {
      var label = port.path;
      if (port.manufacturer) label += " (" + port.manufacturer + ")";
      if (port.isEnttec) label += " — ENTTEC DMX Pro";
      return label;
    },
  };
}
