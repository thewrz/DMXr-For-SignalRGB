/**
 * Channel remap modal mixin for DMXr.
 * Drag-and-drop channel reordering with preset save/recall.
 * Mixed into the main Alpine component via Object.assign.
 */

var REMAP_CHANNEL_COLORS = {
  Red: "#ff4444",
  Green: "#44ff44",
  Blue: "#4488ff",
  White: "#ffffff",
  Amber: "#ffaa00",
  UV: "#aa44ff",
  Cyan: "#00cccc",
  Magenta: "#ff44ff",
  Yellow: "#ffff44",
};

function dmxrChannelRemap() {
  return {
    // Remap modal state
    remapModalOpen: false,
    remapFixtureId: null,
    remapChannels: [],
    remapOriginalOrder: [],
    remapDragIndex: null,
    remapDropIndex: null,
    remapError: "",
    remapPresetKey: null,
    remapPresetAvailable: false,
    remapPresetData: null,
    remapSaving: false,
    pendingChannelRemap: null,

    // --- Open from existing fixture (overflow menu) ---

    openRemapModal(fixtureId) {
      var fixture = this.fixtures.find(function(f) { return f.id === fixtureId; });
      if (!fixture) return;

      this.remapFixtureId = fixtureId;
      this.remapError = "";
      this.remapSaving = false;

      // Build channel list in current (possibly already remapped) order
      var channels = fixture.channels.map(function(ch) {
        return {
          offset: ch.offset,
          name: ch.name,
          type: ch.type,
          color: ch.color || "",
          defaultValue: ch.defaultValue,
        };
      });

      // If fixture already has a remap, reorder channels to show current physical order
      if (fixture.channelRemap && Object.keys(fixture.channelRemap).length > 0) {
        channels = this._applyRemapToChannelList(channels, fixture.channelRemap);
      }

      this.remapChannels = channels;
      this.remapOriginalOrder = channels.map(function(ch) { return ch.offset; });

      // Check for preset
      this.remapPresetKey = this._buildPresetKey(fixture);
      this.remapPresetAvailable = false;
      this.remapPresetData = null;
      if (this.remapPresetKey) {
        this.checkRemapPreset(this.remapPresetKey);
      }

      this.remapModalOpen = true;
    },

    // --- Open from staging flow (pre-creation) ---

    openRemapModalForStaging() {
      this.remapFixtureId = null;
      this.remapError = "";
      this.remapSaving = false;

      var channels = [];
      if (this.browseSource === "ofl" && this.selectedFixtureDef) {
        var built = this.buildChannelsPayload();
        if (built) {
          channels = built.map(function(ch) {
            return {
              offset: ch.offset,
              name: ch.name,
              type: ch.type,
              color: ch.color || "",
              defaultValue: ch.defaultValue,
            };
          });
        }
      } else if (this.libChannels && this.libChannels.length > 0) {
        channels = this.libChannels.map(function(ch) {
          return {
            offset: ch.offset,
            name: ch.name,
            type: ch.type,
            color: ch.color || "",
            defaultValue: ch.defaultValue,
          };
        });
      }

      if (channels.length === 0) return;

      // If a pending remap exists from a previous modal session, apply it
      if (this.pendingChannelRemap && Object.keys(this.pendingChannelRemap).length > 0) {
        channels = this._applyRemapToChannelList(channels, this.pendingChannelRemap);
      }

      this.remapChannels = channels;
      this.remapOriginalOrder = channels.map(function(ch) { return ch.offset; });

      // Check preset
      this.remapPresetKey = this._buildStagingPresetKey();
      this.remapPresetAvailable = false;
      this.remapPresetData = null;
      if (this.remapPresetKey) {
        this.checkRemapPreset(this.remapPresetKey);
      }

      this.remapModalOpen = true;
    },

    // --- Drag and drop (bidirectional swap) ---

    onRemapDragStart(index, event) {
      this.remapDragIndex = index;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    },

    onRemapDragOver(index, event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      this.remapDropIndex = index;
    },

    onRemapDragLeave() {
      this.remapDropIndex = null;
    },

    onRemapDrop(index) {
      if (this.remapDragIndex === null || this.remapDragIndex === index) {
        this.remapDragIndex = null;
        this.remapDropIndex = null;
        return;
      }

      // Bidirectional swap
      var channels = this.remapChannels.slice();
      var temp = channels[this.remapDragIndex];
      channels[this.remapDragIndex] = channels[index];
      channels[index] = temp;
      this.remapChannels = channels;

      this.remapDragIndex = null;
      this.remapDropIndex = null;
    },

    onRemapDragEnd() {
      this.remapDragIndex = null;
      this.remapDropIndex = null;
    },

    // --- Build remap diff ---

    buildChannelRemap() {
      var remap = {};
      for (var i = 0; i < this.remapChannels.length; i++) {
        var ch = this.remapChannels[i];
        // The channel at visual position i has logical offset ch.offset.
        // If ch.offset !== i, it has been remapped: logical ch.offset → physical i.
        if (ch.offset !== i) {
          remap[ch.offset] = i;
        }
      }
      return remap;
    },

    getRemapCount() {
      var remap = this.buildChannelRemap();
      return Object.keys(remap).length;
    },

    isChannelRemapped(index) {
      var ch = this.remapChannels[index];
      return ch && ch.offset !== index;
    },

    // --- Save ---

    async saveRemap() {
      this.remapError = "";
      this.remapSaving = true;

      var remap = this.buildChannelRemap();

      if (this.remapFixtureId) {
        // Existing fixture: PATCH
        try {
          var res = await fetch("/fixtures/" + this.remapFixtureId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelRemap: remap }),
          });
          if (res.ok) {
            var updated = await res.json();
            this.fixtures = this.fixtures.map(function(f) {
              return f.id === updated.id ? updated : f;
            });
            this.remapModalOpen = false;
          } else {
            var err = await res.json().catch(function() { return {}; });
            this.remapError = err.error || "Save failed";
          }
        } catch {
          this.remapError = "Network error";
        }
      } else {
        // Staging mode: store for later
        this.pendingChannelRemap = Object.keys(remap).length > 0 ? remap : null;
        this.remapModalOpen = false;
      }

      this.remapSaving = false;
    },

    // --- Reset ---

    resetRemap() {
      // Restore original offset order (0, 1, 2, ...)
      var sorted = this.remapChannels.slice().sort(function(a, b) {
        return a.offset - b.offset;
      });
      this.remapChannels = sorted;
    },

    // --- Close ---

    closeRemapModal() {
      this.remapModalOpen = false;
      this.remapChannels = [];
      this.remapOriginalOrder = [];
      this.remapDragIndex = null;
      this.remapDropIndex = null;
      this.remapError = "";
      this.remapPresetData = null;
    },

    // --- Test single channel ---

    async testRemapChannel(offset) {
      if (!this.remapFixtureId) return;
      try {
        await fetch("/fixtures/" + this.remapFixtureId + "/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "flash", channelOffset: offset }),
        });
      } catch {
        // ignore
      }
    },

    // --- Presets ---

    async checkRemapPreset(key) {
      if (!key) return;
      try {
        var res = await fetch("/remap-presets/" + encodeURIComponent(key));
        if (res.ok) {
          var data = await res.json();
          this.remapPresetAvailable = true;
          this.remapPresetData = data;
        } else {
          this.remapPresetAvailable = false;
          this.remapPresetData = null;
        }
      } catch {
        this.remapPresetAvailable = false;
        this.remapPresetData = null;
      }
    },

    applyPreset() {
      if (!this.remapPresetData || !this.remapPresetData.remap) return;

      // Reset to original order first, then apply preset remap
      var sorted = this.remapChannels.slice().sort(function(a, b) {
        return a.offset - b.offset;
      });
      this.remapChannels = this._applyRemapToChannelList(sorted, this.remapPresetData.remap);
      this.remapPresetAvailable = false;
    },

    async saveRemapAsPreset() {
      if (!this.remapPresetKey) return;

      var remap = this.buildChannelRemap();
      if (Object.keys(remap).length === 0) return;

      try {
        var res = await fetch("/remap-presets/" + encodeURIComponent(this.remapPresetKey), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelCount: this.remapChannels.length,
            remap: remap,
          }),
        });
        if (!res.ok) {
          var err = await res.json().catch(function() { return {}; });
          this.remapError = err.error || "Preset save failed";
        }
      } catch {
        this.remapError = "Network error saving preset";
      }
    },

    // --- Helpers ---

    getChannelColorCSS(ch) {
      if (!ch.color) return "transparent";
      return REMAP_CHANNEL_COLORS[ch.color] || "transparent";
    },

    _buildPresetKey(fixture) {
      if (fixture.oflKey && fixture.mode) {
        return fixture.oflKey + "/" + fixture.mode;
      }
      return null;
    },

    _buildStagingPresetKey() {
      if (this.browseSource === "ofl" && this.selectedMfr && this.selectedFixtureKey && this.selectedMode) {
        return this.selectedMfr.key + "/" + this.selectedFixtureKey + "/" + this.selectedMode;
      }
      if (this.browseSource !== "ofl" && this.libSelectedFixture && this.libSelectedModeId) {
        var mode = this.libModes.find(function(m) { return m.id == this.libSelectedModeId; }.bind(this));
        var modeName = mode ? mode.name : this.libSelectedModeId;
        return this.browseSource + "/" + this.libSelectedFixture.id + "/" + modeName;
      }
      return null;
    },

    _applyRemapToChannelList(channels, remap) {
      // remap: logical offset → physical offset
      // Reorder channels so that the channel at physical position p
      // is the one whose logical offset maps to p.
      var result = channels.slice();
      for (var sourceStr in remap) {
        var source = parseInt(sourceStr, 10);
        var target = remap[sourceStr];
        // Find the channel with logical offset === source
        var ch = channels.find(function(c) { return c.offset === source; });
        if (ch) {
          result[target] = ch;
        }
      }
      return result;
    },
  };
}
