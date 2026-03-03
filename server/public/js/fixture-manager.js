/**
 * Fixture CRUD and control operations for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrFixtureManager() {
  return {
    async loadFixtures() {
      try {
        var res = await fetch("/fixtures");
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
      setInterval(function() {
        if (!this.isDragging) {
          this.loadFixtures();
        }
      }.bind(this), 3000);
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

    async addFixture() {
      if (this.addressError || !this.fixtureName) return;

      var channels = this.buildChannelsPayload();
      if (!channels) return;

      var payload = {
        name: this.fixtureName,
        oflKey: this.selectedMfr.key + "/" + this.selectedFixtureKey,
        oflFixtureName: this.selectedFixtureDef.name,
        mode: this.selectedMode,
        dmxStartAddress: this.dmxStartAddress,
        channelCount: this.channelCount,
        channels: channels,
      };

      try {
        var res = await fetch("/fixtures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          await this.loadFixtures();
          this.closeAddModal();
        } else {
          var err = await res.json();
          this.addressError = err.message || err.error || "Failed to add fixture";
        }
      } catch {
        this.addressError = "Network error";
      }
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

    async flashHold(id) {
      try {
        await fetch("/fixtures/" + id + "/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "flash-hold" }),
        });
      } catch {
        // ignore
      }
    },

    async flashRelease(id) {
      try {
        await fetch("/fixtures/" + id + "/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "flash-release" }),
        });
      } catch {
        // ignore
      }
    },

    async blackout() {
      try {
        await fetch("/control/blackout", { method: "POST" });
        this.overrideActive = true;
      } catch {
        // ignore
      }
    },

    async whiteout() {
      try {
        await fetch("/control/whiteout", { method: "POST" });
        this.overrideActive = true;
      } catch {
        // ignore
      }
    },

    async resume() {
      try {
        await fetch("/control/resume", { method: "POST" });
        this.overrideActive = false;
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

    closeAddModal() {
      this.showAddModal = false;
      this.fixtureSource = "ofl";
      this.addStep = 1;
      this.mfrSearch = "";
      this.fixtureSearch = "";
      this.selectedMfr = null;
      this.selectedFixtureKey = null;
      this.selectedFixtureDef = null;
      this.selectedMode = "";
      this.channelCount = 0;
      this.channelNames = [];
      this.dmxStartAddress = 1;
      this.fixtureName = "";
      this.addressError = "";
      this.filteredMfrs = this.manufacturers;
      this.filteredFixtures = [];
      this.libStep = 1;
      this.libMfrSearch = "";
      this.libFilteredMfrs = this.libMfrs;
      this.libSelectedMfr = null;
      this.libFixtures = [];
      this.libFixtureSearch = "";
      this.libFilteredFixtures = [];
      this.libSelectedFixture = null;
      this.libModes = [];
      this.libSelectedModeId = null;
      this.libChannels = [];
    },

    switchSource(source) {
      this.fixtureSource = source;
      this.addStep = 1;
      this.libStep = 1;
      this.addressError = "";
      this.dmxStartAddress = 1;
      this.fixtureName = "";
      if (source !== "ofl" && this.libMfrs.length === 0) {
        this.loadLibMfrs(source);
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
        if (!fixture.channelOverrides) fixture.channelOverrides = {};
        var current = fixture.channelOverrides[offset] || { value: 0, enabled: false };
        fixture.channelOverrides[offset] = { value: parseInt(value, 10), enabled: current.enabled };
      }

      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        var f = self.fixtures.find(function(f) { return f.id === fixtureId; });
        if (!f) return;
        self.patchFixture(fixtureId, { channelOverrides: f.channelOverrides });
      }, 150);
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
