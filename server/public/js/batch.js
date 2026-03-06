/**
 * Batch add fixtures modal for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrBatch() {
  return {
    openBatchModal() {
      var staged = this.stagedFixture;
      if (!staged) return;

      this.batchConfig = {
        name: staged.name,
        mode: staged.mode,
        channelCount: staged.channelCount,
        channels: staged.channels,
        oflKey: staged.oflKey,
        oflFixtureName: staged.oflFixtureName,
        source: staged.source,
        libraryId: staged.libraryId,
        libFixtureId: staged.libFixtureId,
        libModeId: staged.libModeId,
        category: staged.category,
      };
      this.batchCount = 2;
      this.batchSpacing = staged.channelCount;
      this.batchStartAddress = this.findBatchStartAddress(staged.channelCount, this.batchCount, staged.channelCount);
      this.batchError = "";
      this.batchModalOpen = true;
      this.updateBatchPreview();
    },

    findBatchStartAddress(channelCount, count, spacing) {
      var occupied = [];
      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        occupied.push({ start: f.dmxStartAddress, end: f.dmxStartAddress + f.channelCount - 1 });
      }
      occupied.sort(function(a, b) { return a.start - b.start; });

      var totalNeeded = channelCount + spacing * (count - 1);

      for (var addr = 1; addr <= 512 - totalNeeded + 1; addr++) {
        var fits = true;
        for (var n = 0; n < count; n++) {
          var start = addr + spacing * n;
          var end = start + channelCount - 1;
          for (var j = 0; j < occupied.length; j++) {
            if (start <= occupied[j].end && end >= occupied[j].start) {
              fits = false;
              addr = occupied[j].end;
              break;
            }
          }
          if (!fits) break;
        }
        if (fits) return addr;
      }
      return 1;
    },

    updateBatchPreview() {
      var preview = [];
      this.batchError = "";

      if (!this.batchConfig) return;

      var count = this.batchCount;
      var spacing = this.batchSpacing;
      var channelCount = this.batchConfig.channelCount;
      var startAddr = this.batchStartAddress;

      if (spacing < channelCount) {
        this.batchError = "Spacing (" + spacing + ") is less than channel count (" + channelCount + ")";
      }

      for (var i = 0; i < count; i++) {
        var addr = startAddr + spacing * i;
        var end = addr + channelCount - 1;
        var name = count === 1
          ? this.batchConfig.name
          : this.batchConfig.name + " " + (i + 1);
        var conflict = "";

        if (end > 512) {
          conflict = "Extends beyond channel 512";
        } else {
          for (var j = 0; j < this.fixtures.length; j++) {
            var f = this.fixtures[j];
            var fEnd = f.dmxStartAddress + f.channelCount - 1;
            if (addr <= fEnd && end >= f.dmxStartAddress) {
              conflict = "Overlaps \"" + f.name + "\"";
              break;
            }
          }
        }

        preview.push({
          name: name,
          start: addr,
          end: end,
          conflict: conflict,
        });
      }

      this.batchPreviewAddresses = preview;
    },

    closeBatchModal() {
      this.batchModalOpen = false;
      this.batchConfig = null;
      this.batchPreviewAddresses = [];
      this.batchError = "";
    },

    async submitBatch() {
      if (this.batchError) return;

      var hasConflict = this.batchPreviewAddresses.some(function(p) { return p.conflict; });
      if (hasConflict) return;

      var config = this.batchConfig;
      var body = {
        name: config.name,
        mode: config.mode,
        channels: config.channels,
        channelCount: config.channelCount,
        startAddress: this.batchStartAddress,
        count: this.batchCount,
        spacing: this.batchSpacing,
      };
      if (config.oflKey) body.oflKey = config.oflKey;
      if (config.oflFixtureName) body.oflFixtureName = config.oflFixtureName;
      if (config.source) body.source = config.source;
      if (config.category) body.category = config.category;
      if (this.selectedUniverseId) body.universeId = this.selectedUniverseId;

      try {
        var res = await fetch("/fixtures/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          this.closeBatchModal();
          this.stagedFixture = null;
          await this.loadFixtures();
        } else {
          var err = await res.json().catch(function() { return {}; });
          this.batchError = err.error || "Batch add failed";
        }
      } catch {
        this.batchError = "Network error";
      }
    },
  };
}
