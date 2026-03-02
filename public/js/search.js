/**
 * Unified search and fixture staging for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrSearch() {
  return {
    performUnifiedSearch() {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(function() {
        this._doUnifiedSearch();
      }.bind(this), 300);
    },

    async _doUnifiedSearch() {
      var q = this.unifiedSearch.trim();
      if (!q || q.length < 2) {
        this.unifiedSearchResults = [];
        return;
      }

      if (this.searchAbort) {
        this.searchAbort.abort();
      }
      var controller = new AbortController();
      this.searchAbort = controller;

      try {
        var res = await fetch("/search?q=" + encodeURIComponent(q), {
          signal: controller.signal,
        });
        if (!res.ok) {
          this.unifiedSearchResults = [];
          return;
        }
        var self = this;
        var results = await res.json();
        this.unifiedSearchResults = results.map(function(r, i) {
          var key = r.type + "-" + r.source + "-" + (r.fixtureId || r.mfrId || r.mfrKey || i);
          var detail = "";
          if (r.type === "fixture") {
            detail = r.manufacturer + (r.modeCount ? " \u00b7 " + r.modeCount + " mode" + (r.modeCount !== 1 ? "s" : "") : "");
          } else {
            detail = (r.fixtureCount || 0) + " fixtures";
          }
          return {
            key: key,
            name: r.name,
            type: r.type,
            detail: detail,
            source: r.source,
            sourceLabel: self.getLibraryDisplayName(r.source),
            manufacturer: r.manufacturer,
            fixtureId: r.fixtureId,
            mfrId: r.mfrId,
            mfrKey: r.mfrKey,
            fixtureKey: r.fixtureKey,
            modeCount: r.modeCount,
            fixtureCount: r.fixtureCount,
            categories: r.categories,
          };
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          this.unifiedSearchResults = [];
        }
      }
    },

    selectSearchResult(result) {
      this.sidebarTab = "browse";
      if (result.type === "fixture" && result.source !== "ofl") {
        this.browseSource = result.source;
        this.selectLibMfr({ id: result.mfrId, name: result.manufacturer, fixtureCount: 0 });
        var fixtureId = result.fixtureId;
        var self = this;
        setTimeout(function() {
          var match = self.libFixtures.find(function(f) { return f.id === fixtureId; });
          if (match) self.selectLibFixture(match);
        }, 500);
      } else if (result.type === "fixture" && result.source === "ofl") {
        this.browseSource = "ofl";
        this.selectManufacturer({ key: result.mfrKey, name: result.manufacturer, fixtureCount: 0 });
        var fixtureKey = result.fixtureKey;
        var self2 = this;
        setTimeout(function() {
          var match = self2.mfrFixtures.find(function(f) { return f.key === fixtureKey; });
          if (match) self2.selectFixture(match);
        }, 500);
      } else if (result.type === "manufacturer" && result.source === "ofl") {
        this.browseSource = "ofl";
        this.selectManufacturer({ key: result.mfrKey, name: result.name, fixtureCount: result.fixtureCount || 0 });
      } else if (result.type === "manufacturer" && result.source !== "ofl") {
        this.browseSource = result.source;
        this.selectLibMfr({ id: result.mfrId, name: result.name, fixtureCount: result.fixtureCount || 0 });
      }
    },

    // --- Staging ---

    stageFixture() {
      if (!this.fixtureName || this.channelCount === 0) return;

      var channels = this.buildChannelsPayload();
      if (!channels) return;

      this.stagedFixture = {
        name: this.fixtureName,
        oflKey: this.selectedMfr.key + "/" + this.selectedFixtureKey,
        oflFixtureName: this.selectedFixtureDef.name,
        source: "ofl",
        mode: this.selectedMode,
        channelCount: this.channelCount,
        channels: channels,
      };
    },

    stageLibFixture() {
      if (!this.fixtureName || !this.libSelectedModeId || this.libChannels.length === 0) return;

      this.stagedFixture = {
        name: this.fixtureName,
        source: this.browseSource,
        libraryId: this.browseSource,
        libFixtureId: this.libSelectedFixture.id,
        libModeId: this.libSelectedModeId,
        mode: this.libModes.find(function(m) { return m.id == this.libSelectedModeId; }.bind(this))?.name || "",
        channelCount: this.libChannels.length,
        channels: this.libChannels,
      };
    },
  };
}
