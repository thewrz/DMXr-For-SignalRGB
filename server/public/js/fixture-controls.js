/**
 * Fixture control operations: flash, blackout/whiteout/resume, component sync,
 * and channel override management.
 * Mixed into the main Alpine component via the fixture-manager.js aggregator.
 */
function dmxrFixtureControls() {
  return {
    async initControlMode() {
      await this.pollControlMode();
    },

    async flashFixture(id) {
      try {
        await fetch("/fixtures/" + id + "/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "flash", durationMs: 500 }),
        });
      } catch (err) {
        console.warn("DMXr: flashFixture failed:", err);
      }
    },

    flashStart(id) {
      this._flashStartTime = Date.now();
      this._flashId = id;
      try {
        fetch("/fixtures/" + id + "/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "flash-hold" }),
        });
      } catch (err) {
        console.warn("DMXr: flashStart failed:", err);
      }
    },

    flashEnd(id) {
      var held = Date.now() - (this._flashStartTime || 0);
      if (held < 200) {
        // Short click: server handles 2s sustain with channel locking
        try {
          fetch("/fixtures/" + id + "/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "flash-click" }),
          });
        } catch (err) {
          console.warn("DMXr: flashEnd (click) failed:", err);
        }
      } else {
        // Long hold: release immediately
        try {
          fetch("/fixtures/" + id + "/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "flash-release" }),
          });
        } catch (err) {
          console.warn("DMXr: flashEnd (release) failed:", err);
        }
      }
    },

    async blackout() {
      try {
        this.controlMode = "blackout";
        this.overrideActive = true;
        var body = this.selectedUniverseId ? { universeId: this.selectedUniverseId } : {};
        await fetch("/control/blackout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.warn("DMXr: blackout failed:", err);
      }
    },

    async whiteout() {
      try {
        this.controlMode = "whiteout";
        this.overrideActive = true;
        var body = this.selectedUniverseId ? { universeId: this.selectedUniverseId } : {};
        await fetch("/control/whiteout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.warn("DMXr: whiteout failed:", err);
      }
    },

    async resume() {
      try {
        this.controlMode = "normal";
        this.overrideActive = false;
        var body = this.selectedUniverseId ? { universeId: this.selectedUniverseId } : {};
        await fetch("/control/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.warn("DMXr: resume failed:", err);
      }
    },

    async syncComponents() {
      this.syncResult = null;
      try {
        var res = await fetch("/signalrgb/components/sync", { method: "POST" });
        if (res.ok) {
          var data = await res.json();
          this.syncResult = { success: true, synced: data.synced, dir: data.componentsDir };
        } else {
          var err = await res.json().catch(function() { return {}; });
          this.syncResult = { success: false, error: err.error || "Sync failed" };
        }
      } catch {
        this.syncResult = { success: false, error: "Network error" };
      }
    },

    // Channel override methods
    toggleFixtureExpand(fixtureId) {
      this.expandedFixtureId = this.expandedFixtureId === fixtureId ? null : fixtureId;
    },

    getOverrideValue(fixture, offset) {
      if (!fixture.channelOverrides) return 0;
      var ov = fixture.channelOverrides[offset];
      return ov ? ov.value : 0;
    },

    isOverrideEnabled(fixture, offset) {
      if (!fixture.channelOverrides) return false;
      var ov = fixture.channelOverrides[offset];
      return ov ? ov.enabled : false;
    },

    async toggleChannelOverride(fixtureId, offset) {
      var fixture = this.fixtures.find(function(f) { return f.id === fixtureId; });
      if (!fixture) return;

      var overrides = Object.assign({}, fixture.channelOverrides || {});
      var current = overrides[offset] || { value: 0, enabled: false };
      overrides[offset] = { value: current.value, enabled: !current.enabled };

      await this.patchFixture(fixtureId, { channelOverrides: overrides });
    },

    setChannelOverrideValue(fixtureId, offset, value) {
      var self = this;
      var key = fixtureId + ":" + offset;

      if (self.overrideTimers[key]) {
        clearTimeout(self.overrideTimers[key]);
      }

      // Update local state immediately for responsiveness
      var fixture = self.fixtures.find(function(f) { return f.id === fixtureId; });
      if (fixture) {
        var ch = fixture.channels.find(function(c) { return c.offset === offset; });
        var parsed = parseInt(value, 10);
        // Clamp to motor guard range if applicable
        if (ch && self._isMotorChannel(fixture, ch)) {
          var buffer = fixture.motorGuardBuffer ?? 4;
          var min = Math.floor(buffer / 2);
          var max = 255 - Math.ceil(buffer / 2);
          parsed = Math.max(min, Math.min(max, parsed));
        }
        if (!fixture.channelOverrides) fixture.channelOverrides = {};
        var current = fixture.channelOverrides[offset] || { value: 0, enabled: false };
        fixture.channelOverrides[offset] = { value: parsed, enabled: current.enabled };
      }

      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        var f = self.fixtures.find(function(f) { return f.id === fixtureId; });
        if (!f) return;
        self.patchFixture(fixtureId, { channelOverrides: f.channelOverrides });
      }, 150);
    },
  };
}
