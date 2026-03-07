/**
 * Fixture CRUD and control operations for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrFixtureManager() {
  return {
    async initControlMode() {
      await this.pollControlMode();
    },

    async loadUniverses() {
      try {
        var res = await fetch("/universes");
        if (res.ok) {
          this.availableUniverses = await res.json();
        }
      } catch {
        // Non-critical — dropdown just won't show extra universes
      }
    },

    switchUniverse(universeId) {
      this.selectedUniverseId = universeId;
      this.loadFixtures();
    },

    async loadFixtures() {
      try {
        var url = "/fixtures";
        if (this.selectedUniverseId) {
          url += "?universeId=" + encodeURIComponent(this.selectedUniverseId);
        }
        var res = await fetch(url);
        if (!res.ok) {
          this.serverOnline = false;
          return;
        }
        var incoming = await res.json();
        this.serverOnline = true;
        // Only replace the array when data actually changed to avoid
        // Alpine tearing down and rebuilding DOM nodes on every poll.
        if (JSON.stringify(this.fixtures) !== JSON.stringify(incoming)) {
          this.fixtures = incoming;
        }
      } catch {
        this.serverOnline = false;
      }
    },

    pollFixtures() {
      var self = this;
      setInterval(function() {
        if (!self.isDragging) {
          self.loadFixtures();
        }
        self.pollControlMode();
        self.loadGroups();
      }, 3000);
    },

    async pollControlMode() {
      try {
        var res = await fetch("/health");
        if (res.ok) {
          var data = await res.json();
          if (data.controlMode) {
            this.controlMode = data.controlMode;
            this.overrideActive = data.controlMode !== "normal";
          }
        }
      } catch {
        // Non-critical — will retry on next poll
      }
    },

    validateAddress(excludeId) {
      this.addressError = "";

      if (this.dmxStartAddress < 1) {
        this.addressError = "Start address must be >= 1";
        return;
      }

      var end = this.dmxStartAddress + this.channelCount - 1;
      if (end > 512) {
        this.addressError = "Extends beyond channel 512 (needs " + this.dmxStartAddress + "-" + end + ")";
        return;
      }

      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        if (excludeId && f.id === excludeId) continue;
        var fEnd = f.dmxStartAddress + f.channelCount - 1;
        if (this.dmxStartAddress <= fEnd && end >= f.dmxStartAddress) {
          this.addressError = "Overlaps with \"" + f.name + "\" (DMX " + f.dmxStartAddress + "-" + fEnd + ")";
          return;
        }
      }
    },

    buildChannelsPayload() {
      var mode = this.selectedFixtureDef.modes.find(
        function(m) { return m.name === this.selectedMode; }.bind(this)
      );
      if (!mode) return null;

      var channels = [];
      var offset = 0;
      var availableChannels = this.selectedFixtureDef.availableChannels || {};

      for (var i = 0; i < mode.channels.length; i++) {
        var chName = mode.channels[i];
        if (chName === null) continue;

        var chDef = availableChannels[chName] || {};
        var type = "NoFunction";
        var color = undefined;
        var defaultValue = 0;
        if (typeof chDef.defaultValue === "number") {
          defaultValue = chDef.defaultValue > 255
            ? Math.floor(chDef.defaultValue / 256)
            : Math.round(chDef.defaultValue);
        }

        if (chDef.capability && chDef.capability.type) {
          type = chDef.capability.type;
          color = chDef.capability.color || undefined;
        } else if (chDef.capabilities && chDef.capabilities.length > 0) {
          for (var j = 0; j < chDef.capabilities.length; j++) {
            if (chDef.capabilities[j].type) {
              type = chDef.capabilities[j].type;
              color = chDef.capabilities[j].color || undefined;
              break;
            }
          }
        }

        var channel = {
          offset: offset,
          name: chName,
          type: type,
          defaultValue: defaultValue,
        };
        if (color) {
          channel.color = color;
        }
        channels.push(channel);
        offset++;
      }

      return channels;
    },

    async removeFixture(id) {
      if (!confirm("Remove this fixture? This cannot be undone.")) return;
      try {
        await fetch("/fixtures/" + id, { method: "DELETE" });
        await this.loadFixtures();
      } catch {
        // ignore
      }
    },

    async flashFixture(id) {
      try {
        await fetch("/fixtures/" + id + "/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "flash", durationMs: 500 }),
        });
      } catch {
        // ignore
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
      } catch {
        // ignore
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
        } catch {
          // ignore
        }
      } else {
        // Long hold: release immediately
        try {
          fetch("/fixtures/" + id + "/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "flash-release" }),
          });
        } catch {
          // ignore
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
      } catch {
        // ignore
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
      } catch {
        // ignore
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
      } catch {
        // ignore
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

    // Reset channel detection
    _resetPatterns: [/\breset\b/i, /\bmaintenance\b/i, /\blamp\s*control\b/i,
                     /\bspecial\b/i, /\bauto\s*mode\b/i, /\bcontrol\s*ch/i],
    _resettingFixtures: {},

    _findResetChannel(fixture) {
      if (fixture.resetConfig) {
        return fixture.channels.find(function(ch) {
          return ch.offset === fixture.resetConfig.channelOffset;
        });
      }
      var patterns = this._resetPatterns;
      for (var p = 0; p < patterns.length; p++) {
        for (var i = 0; i < fixture.channels.length; i++) {
          var ch = fixture.channels[i];
          if (ch.type === "Generic" && patterns[p].test(ch.name)) return ch;
        }
      }
      return null;
    },

    hasResetChannel(fixture) {
      return this._findResetChannel(fixture) !== null;
    },

    getResetChannelName(fixture) {
      var ch = this._findResetChannel(fixture);
      return ch ? ch.name : "";
    },

    isResetting(fixtureId) {
      return !!this._resettingFixtures[fixtureId];
    },

    async resetFixture(fixtureId) {
      if (this._resettingFixtures[fixtureId]) return;
      if (!confirm("Send DMX reset command? The fixture will re-home its motors.")) return;

      this._resettingFixtures[fixtureId] = true;
      try {
        var res = await fetch("/fixtures/" + fixtureId + "/reset", { method: "POST" });
        if (res.ok) {
          var data = await res.json();
          var self = this;
          setTimeout(function() {
            self._resettingFixtures[fixtureId] = false;
          }, data.holdMs || 5000);
        } else {
          var err = await res.json().catch(function() { return {}; });
          alert("Reset failed: " + (err.error || "Unknown error"));
          this._resettingFixtures[fixtureId] = false;
        }
      } catch {
        alert("Reset failed: network error");
        this._resettingFixtures[fixtureId] = false;
      }
    },

    // Motor guard helpers
    _motorTypes: ["Pan", "Tilt", "Focus", "Zoom"],

    _isMotorChannel(fixture, ch) {
      return fixture.motorGuardEnabled !== false &&
             this._motorTypes.indexOf(ch.type) !== -1;
    },

    hasMotorChannels(fixture) {
      var self = this;
      return fixture.channels.some(function(ch) {
        return self._motorTypes.indexOf(ch.type) !== -1;
      });
    },

    getSliderMin(fixture, ch) {
      if (this._isMotorChannel(fixture, ch)) {
        var buffer = fixture.motorGuardBuffer ?? 4;
        return Math.max(ch.rangeMin || 0, Math.floor(buffer / 2));
      }
      return ch.rangeMin || 0;
    },

    getSliderMax(fixture, ch) {
      if (this._isMotorChannel(fixture, ch)) {
        var buffer = fixture.motorGuardBuffer ?? 4;
        return Math.min(ch.rangeMax || 255, 255 - Math.ceil(buffer / 2));
      }
      return ch.rangeMax || 255;
    },

    async toggleMotorGuard(fixtureId, enabled) {
      await this.patchFixture(fixtureId, { motorGuardEnabled: enabled });
    },

    setMotorGuardBuffer(fixtureId, value) {
      var self = this;
      var key = "mg:" + fixtureId;
      if (self.overrideTimers[key]) {
        clearTimeout(self.overrideTimers[key]);
      }
      var fixture = self.fixtures.find(function(f) { return f.id === fixtureId; });
      if (fixture) {
        fixture.motorGuardBuffer = parseInt(value, 10);
      }
      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        self.patchFixture(fixtureId, { motorGuardBuffer: parseInt(value, 10) });
      }, 250);
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

    // --- Color Calibration ---

    hasColorChannels(fixture) {
      return fixture.channels.some(function(ch) {
        return ch.type === "ColorIntensity" &&
          (ch.color === "Red" || ch.color === "Green" || ch.color === "Blue");
      });
    },

    getCalGain(fixture, channel) {
      if (!fixture.colorCalibration) return 1.0;
      return fixture.colorCalibration.gain[channel];
    },

    getCalOffset(fixture, channel) {
      if (!fixture.colorCalibration) return 0;
      return fixture.colorCalibration.offset[channel];
    },

    setCalGain(fixtureId, channel, value) {
      var self = this;
      var key = "cal-gain:" + fixtureId + ":" + channel;
      if (self.overrideTimers[key]) {
        clearTimeout(self.overrideTimers[key]);
      }
      var fixture = self.fixtures.find(function(f) { return f.id === fixtureId; });
      if (!fixture) return;
      var parsed = parseFloat(value);
      if (!fixture.colorCalibration) {
        fixture.colorCalibration = {
          gain: { r: 1.0, g: 1.0, b: 1.0 },
          offset: { r: 0, g: 0, b: 0 },
        };
      }
      fixture.colorCalibration = {
        gain: Object.assign({}, fixture.colorCalibration.gain, (function() { var o = {}; o[channel] = parsed; return o; })()),
        offset: fixture.colorCalibration.offset,
      };
      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        var f = self.fixtures.find(function(f) { return f.id === fixtureId; });
        if (!f) return;
        self.patchFixture(fixtureId, { colorCalibration: f.colorCalibration });
      }, 300);
    },

    setCalOffset(fixtureId, channel, value) {
      var self = this;
      var key = "cal-offset:" + fixtureId + ":" + channel;
      if (self.overrideTimers[key]) {
        clearTimeout(self.overrideTimers[key]);
      }
      var fixture = self.fixtures.find(function(f) { return f.id === fixtureId; });
      if (!fixture) return;
      var parsed = parseInt(value, 10);
      if (!fixture.colorCalibration) {
        fixture.colorCalibration = {
          gain: { r: 1.0, g: 1.0, b: 1.0 },
          offset: { r: 0, g: 0, b: 0 },
        };
      }
      fixture.colorCalibration = {
        gain: fixture.colorCalibration.gain,
        offset: Object.assign({}, fixture.colorCalibration.offset, (function() { var o = {}; o[channel] = parsed; return o; })()),
      };
      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        var f = self.fixtures.find(function(f) { return f.id === fixtureId; });
        if (!f) return;
        self.patchFixture(fixtureId, { colorCalibration: f.colorCalibration });
      }, 300);
    },

    resetCalibration(fixtureId) {
      var cal = {
        gain: { r: 1.0, g: 1.0, b: 1.0 },
        offset: { r: 0, g: 0, b: 0 },
      };
      var fixture = this.fixtures.find(function(f) { return f.id === fixtureId; });
      if (fixture) fixture.colorCalibration = cal;
      this.patchFixture(fixtureId, { colorCalibration: cal });
    },

    // --- Duplicate ---

    findNextAvailableAddress(channelCount, excludeId) {
      var occupied = [];
      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        if (excludeId && f.id === excludeId) continue;
        occupied.push({ start: f.dmxStartAddress, end: f.dmxStartAddress + f.channelCount - 1 });
      }
      occupied.sort(function(a, b) { return a.start - b.start; });

      for (var addr = 1; addr <= 512 - channelCount + 1; addr++) {
        var fits = true;
        for (var j = 0; j < occupied.length; j++) {
          if (addr <= occupied[j].end && addr + channelCount - 1 >= occupied[j].start) {
            fits = false;
            addr = occupied[j].end; // loop will increment
            break;
          }
        }
        if (fits) return addr;
      }
      return 1;
    },

    startDuplicate(fixtureId) {
      var fixture = this.fixtures.find(function(f) { return f.id === fixtureId; });
      if (!fixture) return;
      this.dupeFixtureId = fixtureId;
      this.dupeName = fixture.name + " (copy)";
      this.dupeAddress = this.findNextAvailableAddress(fixture.channelCount);
      this.dupeError = "";
    },

    cancelDuplicate() {
      this.dupeFixtureId = null;
      this.dupeName = "";
      this.dupeAddress = 1;
      this.dupeError = "";
    },

    validateDupeAddress(fixture) {
      this.dupeError = "";
      if (this.dupeAddress < 1) {
        this.dupeError = "Start address must be >= 1";
        return;
      }
      var end = this.dupeAddress + fixture.channelCount - 1;
      if (end > 512) {
        this.dupeError = "Extends beyond channel 512 (needs " + this.dupeAddress + "-" + end + ")";
        return;
      }
      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        var fEnd = f.dmxStartAddress + f.channelCount - 1;
        if (this.dupeAddress <= fEnd && end >= f.dmxStartAddress) {
          this.dupeError = "Overlaps with \"" + f.name + "\" (DMX " + f.dmxStartAddress + "-" + fEnd + ")";
          return;
        }
      }
    },

    async confirmDuplicate(fixtureId) {
      if (this.dupeError) return;
      try {
        var res = await fetch("/fixtures/" + fixtureId + "/duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: this.dupeName,
            dmxStartAddress: this.dupeAddress,
          }),
        });
        if (res.ok) {
          this.cancelDuplicate();
          await this.loadFixtures();
        } else {
          var err = await res.json().catch(function() { return {}; });
          this.dupeError = err.error || "Duplicate failed";
        }
      } catch {
        this.dupeError = "Network error";
      }
    },

    async patchFixture(fixtureId, changes) {
      try {
        var res = await fetch("/fixtures/" + fixtureId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        if (res.ok) {
          var updated = await res.json();
          this.fixtures = this.fixtures.map(function(f) {
            return f.id === fixtureId ? updated : f;
          });
        }
      } catch {
        // ignore
      }
    },
  };
}
