/**
 * Library browsing (OFL + local-db) for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */

/**
 * Shared filter-by-name utility used by both OFL and library
 * manufacturer/fixture filtering.
 */
function filterByName(items, search) {
  if (!search) return items;
  var lower = search.toLowerCase();
  return items.filter(function(item) {
    return item.name.toLowerCase().includes(lower);
  });
}

function dmxrLibraryBrowser() {
  return {
    // --- OFL browsing ---

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
      this.filteredMfrs = filterByName(this.manufacturers, this.mfrSearch);
    },

    async selectManufacturer(mfr) {
      this.selectedMfr = mfr;
      this.browseStep = 2;
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
      this.filteredFixtures = filterByName(this.mfrFixtures, this.fixtureSearch);
    },

    async selectFixture(fixture) {
      this.selectedFixtureKey = fixture.key;
      this.browseStep = 3;
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

    // --- Library (non-OFL) browsing ---

    switchBrowseSource(source) {
      this.browseSource = source;
      this.browseStep = 1;
      this.libStep = 1;
      if (source !== "ofl" && this.libMfrs.length === 0) {
        this.loadLibMfrs(source);
      }
    },

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
      this.libFilteredMfrs = filterByName(this.libMfrs, this.libMfrSearch);
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
      this.libFilteredFixtures = filterByName(this.libFixtures, this.libFixtureSearch);
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

    // --- OFL fixture export (in-memory def) ---

    exportOflFixture() {
      var def = this.selectedFixtureDef;
      if (!def) return;

      var base = buildOflMeta();
      var ofl = {
        $schema: base.$schema,
        name: def.name,
        categories: def.categories || ["Other"],
        meta: base.meta,
        availableChannels: def.availableChannels || {},
        modes: def.modes || [],
      };

      triggerJsonDownload(ofl, slugify(def.name) + ".json");
    },

    // --- Library fixture export (fetches all modes) ---

    async exportLibFixtureOfl() {
      if (!this.libSelectedFixture || !this.libModes.length) return;

      var self = this;
      var libId = this.browseSource;
      var fixtureId = this.libSelectedFixture.id;

      // Fetch channels for every mode in parallel
      var fetches = this.libModes.map(function(mode) {
        return fetch(
          "/libraries/" + libId +
          "/fixtures/" + fixtureId +
          "/modes/" + mode.id + "/channels"
        ).then(function(res) { return res.json(); })
         .then(function(channels) {
           return { name: mode.name, channels: channels };
         });
      });

      try {
        var modes = await Promise.all(fetches);

        // Derive category from first mode's channels
        var firstChannels = modes[0] ? modes[0].channels : [];
        var category = deriveFixtureCategory(firstChannels, self.libSelectedFixture.name);
        var oflCategories = DMXR_TO_OFL_CATEGORIES[category] || ["Other"];

        var ofl = buildOflExportJson(self.libSelectedFixture.name, oflCategories, modes);
        triggerJsonDownload(ofl, slugify(self.libSelectedFixture.name) + ".json");
      } catch {
        alert("Export failed — check server connection");
      }
    },

  };
}
