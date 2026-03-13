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
          if (this.pruneSelection) this.pruneSelection();
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
          if (data.connectionState) {
            this.dmxConnectionState = data.connectionState;
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
      } catch (err) {
        console.warn("DMXr: removeFixture failed:", err);
      }
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
      } catch (err) {
        console.warn("DMXr: patchFixture failed:", err);
      }
    },
  };
}
