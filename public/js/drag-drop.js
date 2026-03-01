/**
 * Drag-and-drop + enhanced grid logic for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrDragDrop() {
  return {
    // Drag and drop state
    isDragging: false,
    dragPreview: null,
    dragTargetAddress: null,
    dragPreviewValid: false,

    // Tooltip state
    tooltip: { visible: false, x: 0, y: 0, content: "" },

    // Fixture card hover → grid highlight
    highlightedFixtureId: null,

    // Grid error toast
    gridError: "",
    gridErrorTimer: null,

    // --- Enhanced Universe Grid ---

    getFixtureAtChannel: function(ch) {
      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        if (ch >= f.dmxStartAddress && ch < f.dmxStartAddress + f.channelCount) {
          return { fixture: f, index: i, offset: ch - f.dmxStartAddress };
        }
      }
      return null;
    },

    isFixtureStart: function(ch) {
      for (var i = 0; i < this.fixtures.length; i++) {
        if (this.fixtures[i].dmxStartAddress === ch) return true;
      }
      return false;
    },

    getEnhancedChannelClass: function(ch) {
      var classes = [];

      if (this.dragTargetAddress !== null && this.dragPreview) {
        var previewEnd = this.dragTargetAddress + this.dragPreview.channelCount - 1;
        if (ch >= this.dragTargetAddress && ch <= previewEnd) {
          classes.push(this.dragPreviewValid ? "drop-target-valid" : "drop-target-invalid");
          return classes.join(" ");
        }
      }

      var info = this.getFixtureAtChannel(ch);
      if (!info) return classes.join(" ");

      var colorIndex = info.index % 8;
      classes.push("fixture-" + colorIndex);

      if (info.offset === 0) classes.push("fixture-start");
      if (info.offset === info.fixture.channelCount - 1) classes.push("fixture-end");

      if (this.highlightedFixtureId && info.fixture.id === this.highlightedFixtureId) {
        classes.push("fixture-highlight");
      }

      return classes.join(" ");
    },

    getChannelLabel: function(ch) {
      return ch;
    },

    showTooltip: function(event, ch) {
      var info = this.getFixtureAtChannel(ch);
      if (!info) {
        this.tooltip = { visible: false, x: 0, y: 0, content: "" };
        return;
      }

      var f = info.fixture;
      var chDef = f.channels[info.offset];
      var chName = chDef ? chDef.name : "ch" + info.offset;
      var chType = chDef ? chDef.type : "";

      var content = "<strong>" + this.escapeHtml(f.name) + "</strong>";
      content += "<span class=\"tooltip-channel\">DMX " + ch;
      content += " &middot; " + this.escapeHtml(chName);
      if (chType) content += " (" + this.escapeHtml(chType) + ")";
      content += "</span>";

      var rect = event.target.getBoundingClientRect();
      this.tooltip = {
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        content: content,
      };
    },

    hideTooltip: function() {
      this.tooltip = { visible: false, x: 0, y: 0, content: "" };
    },

    escapeHtml: function(str) {
      var div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    },

    // --- Drag and Drop ---

    onDragEnd: function() {
      this.clearDragPreview();
    },

    onStagedDragStart: function(event) {
      if (!this.stagedFixture) return;
      this.isDragging = true;
      this.dragPreview = {
        channelCount: this.stagedFixture.channelCount,
        excludeId: null,
        type: "stage",
      };
      event.dataTransfer.setData("application/x-dmxr-fixture", "staged");
      event.dataTransfer.effectAllowed = "copy";
    },

    onFixtureDragStart: function(event, ch) {
      var info = this.getFixtureAtChannel(ch);
      if (!info || info.offset !== 0) {
        event.preventDefault();
        return;
      }

      this.isDragging = true;
      this.dragPreview = {
        channelCount: info.fixture.channelCount,
        excludeId: info.fixture.id,
        type: "move",
      };
      event.dataTransfer.setData("application/x-dmxr-fixture", info.fixture.id);
      event.dataTransfer.effectAllowed = "move";
    },

    onGridDragOver: function(event) {
      var cell = event.target.closest(".channel-cell");
      if (!cell || !this.dragPreview) return;

      var address = parseInt(cell.dataset.address, 10);
      if (isNaN(address)) return;

      event.dataTransfer.dropEffect = this.dragPreview.type === "stage" ? "copy" : "move";

      this.dragTargetAddress = address;
      this.dragPreviewValid = this.isDropValid(address);
    },

    onGridDragLeave: function(event) {
      var grid = event.currentTarget;
      var related = event.relatedTarget;
      if (related && grid.contains(related)) return;

      this.dragTargetAddress = null;
      this.dragPreviewValid = false;
    },

    onGridDrop: function(event) {
      var cell = event.target.closest(".channel-cell");
      if (!cell || !this.dragPreview) {
        this.clearDragPreview();
        return;
      }

      var address = parseInt(cell.dataset.address, 10);
      if (isNaN(address)) {
        this.clearDragPreview();
        return;
      }

      if (!this.isDropValid(address)) {
        this.showGridError("Cannot place here: overlaps with existing fixture or exceeds channel 512");
        this.clearDragPreview();
        return;
      }

      var fixtureId = event.dataTransfer.getData("application/x-dmxr-fixture");

      if (fixtureId === "staged") {
        this.createFixtureAtAddress(address);
      } else {
        this.moveFixtureToAddress(fixtureId, address);
      }

      this.clearDragPreview();
    },

    isDropValid: function(address) {
      if (!this.dragPreview) return false;

      var count = this.dragPreview.channelCount;
      var end = address + count - 1;

      if (end > 512) return false;

      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        if (this.dragPreview.excludeId && f.id === this.dragPreview.excludeId) continue;

        var fEnd = f.dmxStartAddress + f.channelCount - 1;
        if (address <= fEnd && end >= f.dmxStartAddress) {
          return false;
        }
      }

      return true;
    },

    createFixtureAtAddress: async function(address) {
      if (!this.stagedFixture) return;

      var staged = this.stagedFixture;

      if (staged.source === "soundswitch") {
        try {
          var res = await fetch(
            "/soundswitch/fixtures/" + staged.ssFixtureId +
            "/modes/" + staged.ssModeId + "/import",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: staged.name,
                dmxStartAddress: address,
              }),
            }
          );

          if (res.ok) {
            await this.loadFixtures();
            this.stagedFixture = null;
          } else {
            var err = await res.json();
            this.showGridError(err.error || "Failed to create fixture");
          }
        } catch (e) {
          this.showGridError("Network error");
        }
        return;
      }

      var payload = {
        name: staged.name,
        oflKey: staged.oflKey,
        oflFixtureName: staged.oflFixtureName,
        mode: staged.mode,
        dmxStartAddress: address,
        channelCount: staged.channelCount,
        channels: staged.channels,
      };

      try {
        var res2 = await fetch("/fixtures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res2.ok) {
          await this.loadFixtures();
          this.stagedFixture = null;
        } else {
          var err2 = await res2.json();
          this.showGridError(err2.error || "Failed to create fixture");
        }
      } catch (e) {
        this.showGridError("Network error");
      }
    },

    moveFixtureToAddress: async function(fixtureId, address) {
      try {
        var res = await fetch("/fixtures/" + fixtureId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dmxStartAddress: address }),
        });

        if (res.ok) {
          await this.loadFixtures();
        } else {
          var err = await res.json();
          this.showGridError(err.error || "Failed to move fixture");
        }
      } catch (e) {
        this.showGridError("Network error");
      }
    },

    clearDragPreview: function() {
      this.isDragging = false;
      this.dragPreview = null;
      this.dragTargetAddress = null;
      this.dragPreviewValid = false;
    },

    showGridError: function(msg) {
      this.gridError = msg;
      if (this.gridErrorTimer) clearTimeout(this.gridErrorTimer);
      this.gridErrorTimer = setTimeout(function() {
        this.gridError = "";
      }.bind(this), 4000);
    },
  };
}
