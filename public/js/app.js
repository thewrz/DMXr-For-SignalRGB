function dmxrApp() {
  var app = {
    fixtures: [],
    serverOnline: false,
    overrideActive: false,
    sidebarOpen: false,
    showAddModal: false,
    fixtureSource: "ofl",
    addStep: 1,

    // Sidebar state
    sidebarTab: "search",
    browseSource: "ofl",
    browseStep: 1,
    unifiedSearch: "",
    unifiedSearchResults: [],
    stagedFixture: null,

    // Libraries (dynamic)
    libraries: [],

    // OFL: Manufacturer search
    manufacturers: [],
    mfrSearch: "",
    filteredMfrs: [],
    oflError: "",

    // OFL: Fixture search
    selectedMfr: null,
    mfrFixtures: [],
    fixtureSearch: "",
    filteredFixtures: [],

    // OFL: Fixture config
    selectedFixtureKey: null,
    selectedFixtureDef: null,
    selectedMode: "",
    channelCount: 0,
    channelNames: [],
    dmxStartAddress: 1,
    fixtureName: "",
    addressError: "",

    // Library (non-OFL) state
    libStep: 1,
    libMfrs: [],
    libMfrSearch: "",
    libFilteredMfrs: [],
    libSelectedMfr: null,
    libFixtures: [],
    libFixtureSearch: "",
    libFilteredFixtures: [],
    libSelectedFixture: null,
    libModes: [],
    libSelectedModeId: null,
    libChannels: [],

    // Unified search debounce
    searchTimer: null,
    searchAbort: null,

    syncResult: null,

    async init() {
      await this.loadFixtures();
      await this.loadManufacturers();
      await this.loadLibraries();
      this.pollFixtures();
    },

    async loadFixtures() {
      try {
        var res = await fetch("/fixtures");
        if (!res.ok) {
          this.serverOnline = false;
          return;
        }
        this.fixtures = await res.json();
        this.serverOnline = true;
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

    async loadManufacturers() {
      this.oflError = "";
      try {
        var res = await fetch("/ofl/manufacturers");
        if (!res.ok) {
          this.oflError = "Server returned " + res.status + " loading manufacturers";
          this.manufacturers = [];
          return;
        }
        var data = await res.json();
        this.manufacturers = Object.entries(data).map(function(entry) {
          return {
            key: entry[0],
            name: entry[1].name,
            fixtureCount: entry[1].fixtureCount || 0,
          };
        }).sort(function(a, b) {
          return a.name.localeCompare(b.name);
        });
        this.filteredMfrs = this.manufacturers;
      } catch {
        this.oflError = "Could not reach OFL API. Check server connectivity to open-fixture-library.org";
        this.manufacturers = [];
      }
    },

    async loadLibraries() {
      try {
        var res = await fetch("/libraries");
        if (res.ok) {
          this.libraries = await res.json();
        }
      } catch {
        this.libraries = [];
      }
    },

    getLibraryDisplayName(sourceId) {
      var lib = this.libraries.find(function(l) { return l.id === sourceId; });
      return lib ? lib.displayName : sourceId;
    },

    getNonOflLibraries() {
      return this.libraries.filter(function(l) { return l.id !== "ofl"; });
    },

    filterManufacturers() {
      var search = this.mfrSearch.toLowerCase();
      if (!search) {
        this.filteredMfrs = this.manufacturers;
        return;
      }
      this.filteredMfrs = this.manufacturers.filter(function(m) {
        return m.name.toLowerCase().includes(search);
      });
    },

    async selectManufacturer(mfr) {
      this.selectedMfr = mfr;
      this.browseStep = 2;
      this.addStep = 2;
      this.fixtureSearch = "";

      try {
        var res = await fetch("/ofl/manufacturers/" + mfr.key);
        var data = await res.json();
        this.mfrFixtures = data.fixtures || [];
        this.filteredFixtures = this.mfrFixtures;
      } catch {
        this.mfrFixtures = [];
        this.filteredFixtures = [];
      }
    },

    filterFixtures() {
      var search = this.fixtureSearch.toLowerCase();
      if (!search) {
        this.filteredFixtures = this.mfrFixtures;
        return;
      }
      this.filteredFixtures = this.mfrFixtures.filter(function(f) {
        return f.name.toLowerCase().includes(search);
      });
    },

    async selectFixture(fixture) {
      this.selectedFixtureKey = fixture.key;
      this.browseStep = 3;
      this.addStep = 3;
      this.selectedMode = "";
      this.channelCount = 0;

      try {
        var res = await fetch("/ofl/fixture/" + this.selectedMfr.key + "/" + fixture.key);
        this.selectedFixtureDef = await res.json();

        if (this.selectedFixtureDef.modes && this.selectedFixtureDef.modes.length > 0) {
          this.selectedMode = this.selectedFixtureDef.modes[0].name;
          this.onModeChange();
        }

        this.fixtureName = fixture.name;
        this.validateAddress();
      } catch {
        this.selectedFixtureDef = null;
      }
    },

    onModeChange() {
      if (!this.selectedFixtureDef) return;

      var mode = this.selectedFixtureDef.modes.find(
        function(m) { return m.name === this.selectedMode; }.bind(this)
      );

      if (mode) {
        var activeChannels = mode.channels.filter(function(c) { return c !== null; });
        this.channelCount = activeChannels.length;
        this.channelNames = activeChannels;
      } else {
        this.channelCount = 0;
        this.channelNames = [];
      }
      this.validateAddress();
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

    // --- Unified Search ---

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

    switchBrowseSource(source) {
      this.browseSource = source;
      this.browseStep = 1;
      this.libStep = 1;
      if (source !== "ofl" && this.libMfrs.length === 0) {
        this.loadLibMfrs(source);
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

    // --- Library (non-OFL) methods ---

    isLibAvailable(libId) {
      var lib = this.libraries.find(function(l) { return l.id === libId; });
      return lib && lib.status && lib.status.available;
    },

    getLibStatus(libId) {
      var lib = this.libraries.find(function(l) { return l.id === libId; });
      return lib ? lib.status : null;
    },

    async loadLibMfrs(libId) {
      try {
        var res = await fetch("/libraries/" + libId + "/manufacturers");
        if (!res.ok) return;
        this.libMfrs = await res.json();
        this.libFilteredMfrs = this.libMfrs;
      } catch {
        this.libMfrs = [];
        this.libFilteredMfrs = [];
      }
    },

    filterLibMfrs() {
      var search = this.libMfrSearch.toLowerCase();
      if (!search) {
        this.libFilteredMfrs = this.libMfrs;
        return;
      }
      this.libFilteredMfrs = this.libMfrs.filter(function(m) {
        return m.name.toLowerCase().includes(search);
      });
    },

    async selectLibMfr(mfr) {
      this.libSelectedMfr = mfr;
      this.libStep = 2;
      this.libFixtureSearch = "";
      try {
        var res = await fetch("/libraries/" + this.browseSource + "/manufacturers/" + mfr.id + "/fixtures");
        this.libFixtures = await res.json();
        this.libFilteredFixtures = this.libFixtures;
      } catch {
        this.libFixtures = [];
        this.libFilteredFixtures = [];
      }
    },

    filterLibFixtures() {
      var search = this.libFixtureSearch.toLowerCase();
      if (!search) {
        this.libFilteredFixtures = this.libFixtures;
        return;
      }
      this.libFilteredFixtures = this.libFixtures.filter(function(f) {
        return f.name.toLowerCase().includes(search);
      });
    },

    async selectLibFixture(fixture) {
      this.libSelectedFixture = fixture;
      this.libStep = 3;
      this.fixtureName = fixture.name;
      try {
        var res = await fetch("/libraries/" + this.browseSource + "/fixtures/" + fixture.id + "/modes");
        var data = await res.json();
        this.libModes = data.modes || [];
        if (this.libModes.length > 0) {
          this.libSelectedModeId = this.libModes[0].id;
          this.channelCount = this.libModes[0].channelCount;
          await this.loadLibChannels();
        }
        this.validateAddress();
      } catch {
        this.libModes = [];
      }
    },

    async onLibModeChange() {
      var mode = this.libModes.find(function(m) { return m.id == this.libSelectedModeId; }.bind(this));
      if (mode) {
        this.channelCount = mode.channelCount;
      }
      await this.loadLibChannels();
      this.validateAddress();
    },

    async loadLibChannels() {
      if (!this.libSelectedFixture || !this.libSelectedModeId) return;
      try {
        var res = await fetch(
          "/libraries/" + this.browseSource +
          "/fixtures/" + this.libSelectedFixture.id +
          "/modes/" + this.libSelectedModeId + "/channels"
        );
        this.libChannels = await res.json();
        this.channelCount = this.libChannels.length;
      } catch {
        this.libChannels = [];
      }
    },

    async importLibFixture() {
      if (this.addressError || !this.fixtureName || !this.libSelectedModeId) return;

      try {
        var res = await fetch(
          "/libraries/" + this.browseSource +
          "/fixtures/" + this.libSelectedFixture.id +
          "/modes/" + this.libSelectedModeId + "/import",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: this.fixtureName,
              dmxStartAddress: this.dmxStartAddress,
            }),
          }
        );

        if (res.ok) {
          await this.loadFixtures();
          this.closeAddModal();
        } else {
          var err = await res.json();
          this.addressError = err.message || err.error || "Failed to import fixture";
        }
      } catch {
        this.addressError = "Network error";
      }
    },
  };

  return Object.assign(app, dmxrDragDrop());
}
