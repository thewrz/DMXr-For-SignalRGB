/**
 * Fixture CRUD operations, loading, polling, and duplication.
 * Mixed into the main Alpine component via the fixture-manager.js aggregator.
 */
function dmxrFixtureCrud() {
  return {
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
  };
}
