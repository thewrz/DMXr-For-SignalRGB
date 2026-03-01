function dmxrApp() {
  return {
    fixtures: [],
    serverOnline: false,
    overrideActive: false,
    showAddModal: false,
    fixtureSource: "ofl",
    addStep: 1,

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

    // SoundSwitch state
    ssAvailable: false,
    ssStatus: null,
    ssStep: 1,
    ssMfrs: [],
    ssMfrSearch: "",
    ssFilteredMfrs: [],
    ssSelectedMfr: null,
    ssFixtures: [],
    ssFixtureSearch: "",
    ssFilteredFixtures: [],
    ssSelectedFixture: null,
    ssModes: [],
    ssSelectedModeId: null,
    ssChannels: [],

    async init() {
      await this.loadFixtures();
      await this.loadManufacturers();
      await this.checkSsAvailable();
      this.pollFixtures();
    },

    async loadFixtures() {
      try {
        const res = await fetch("/fixtures");
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
      setInterval(() => this.loadFixtures(), 3000);
    },

    async loadManufacturers() {
      this.oflError = "";
      try {
        const res = await fetch("/ofl/manufacturers");
        if (!res.ok) {
          this.oflError = "Server returned " + res.status + " loading manufacturers";
          this.manufacturers = [];
          return;
        }
        const data = await res.json();
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

    validateAddress() {
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
        var fEnd = f.dmxStartAddress + f.channelCount - 1;
        if (this.dmxStartAddress <= fEnd && end >= f.dmxStartAddress) {
          this.addressError = "Overlaps with \"" + f.name + "\" (DMX " + f.dmxStartAddress + "-" + fEnd + ")";
          return;
        }
      }
    },

    async addFixture() {
      if (this.addressError || !this.fixtureName) return;

      var mode = this.selectedFixtureDef.modes.find(
        function(m) { return m.name === this.selectedMode; }.bind(this)
      );
      if (!mode) return;

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
          // OFL stores 16-bit defaults as combined values (e.g., 32639 for Pan center).
          // Extract the high byte for the coarse DMX channel (0-255 range).
          defaultValue = chDef.defaultValue > 255
            ? Math.floor(chDef.defaultValue / 256)
            : Math.round(chDef.defaultValue);
        }

        // Extract type and color from capability (singular) or capabilities (array)
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

    syncResult: null,

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

    getChannelClass(ch) {
      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        if (ch >= f.dmxStartAddress && ch < f.dmxStartAddress + f.channelCount) {
          return "occupied";
        }
      }
      return "";
    },

    getChannelTooltip(ch) {
      for (var i = 0; i < this.fixtures.length; i++) {
        var f = this.fixtures[i];
        if (ch >= f.dmxStartAddress && ch < f.dmxStartAddress + f.channelCount) {
          var offset = ch - f.dmxStartAddress;
          var chDef = f.channels[offset];
          return f.name + " - " + (chDef ? chDef.name : "ch" + offset);
        }
      }
      return "Channel " + ch;
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
      this.ssStep = 1;
      this.ssMfrSearch = "";
      this.ssFilteredMfrs = this.ssMfrs;
      this.ssSelectedMfr = null;
      this.ssFixtures = [];
      this.ssFixtureSearch = "";
      this.ssFilteredFixtures = [];
      this.ssSelectedFixture = null;
      this.ssModes = [];
      this.ssSelectedModeId = null;
      this.ssChannels = [];
    },

    switchSource(source) {
      this.fixtureSource = source;
      this.addStep = 1;
      this.ssStep = 1;
      this.addressError = "";
      this.dmxStartAddress = 1;
      this.fixtureName = "";
      if (source === "soundswitch" && this.ssMfrs.length === 0) {
        this.loadSsMfrs();
      }
    },

    async checkSsAvailable() {
      try {
        var res = await fetch("/soundswitch/status");
        if (res.ok) {
          this.ssStatus = await res.json();
          this.ssAvailable = this.ssStatus.available;
        } else {
          this.ssAvailable = false;
          this.ssStatus = null;
        }
      } catch {
        this.ssAvailable = false;
        this.ssStatus = null;
      }
    },

    async loadSsMfrs() {
      try {
        var res = await fetch("/soundswitch/manufacturers");
        if (!res.ok) return;
        this.ssMfrs = await res.json();
        this.ssFilteredMfrs = this.ssMfrs;
      } catch {
        this.ssMfrs = [];
        this.ssFilteredMfrs = [];
      }
    },

    filterSsMfrs() {
      var search = this.ssMfrSearch.toLowerCase();
      if (!search) {
        this.ssFilteredMfrs = this.ssMfrs;
        return;
      }
      this.ssFilteredMfrs = this.ssMfrs.filter(function(m) {
        return m.name.toLowerCase().includes(search);
      });
    },

    async selectSsMfr(mfr) {
      this.ssSelectedMfr = mfr;
      this.ssStep = 2;
      this.ssFixtureSearch = "";
      try {
        var res = await fetch("/soundswitch/manufacturers/" + mfr.id + "/fixtures");
        this.ssFixtures = await res.json();
        this.ssFilteredFixtures = this.ssFixtures;
      } catch {
        this.ssFixtures = [];
        this.ssFilteredFixtures = [];
      }
    },

    filterSsFixtures() {
      var search = this.ssFixtureSearch.toLowerCase();
      if (!search) {
        this.ssFilteredFixtures = this.ssFixtures;
        return;
      }
      this.ssFilteredFixtures = this.ssFixtures.filter(function(f) {
        return f.name.toLowerCase().includes(search);
      });
    },

    async selectSsFixture(fixture) {
      this.ssSelectedFixture = fixture;
      this.ssStep = 3;
      this.fixtureName = fixture.name;
      try {
        var res = await fetch("/soundswitch/fixtures/" + fixture.id);
        var data = await res.json();
        this.ssModes = data.modes || [];
        if (this.ssModes.length > 0) {
          this.ssSelectedModeId = this.ssModes[0].id;
          this.channelCount = this.ssModes[0].channelCount;
          await this.loadSsChannels();
        }
        this.validateAddress();
      } catch {
        this.ssModes = [];
      }
    },

    async onSsModeChange() {
      var mode = this.ssModes.find(function(m) { return m.id == this.ssSelectedModeId; }.bind(this));
      if (mode) {
        this.channelCount = mode.channelCount;
      }
      await this.loadSsChannels();
      this.validateAddress();
    },

    async loadSsChannels() {
      if (!this.ssSelectedFixture || !this.ssSelectedModeId) return;
      try {
        var res = await fetch(
          "/soundswitch/fixtures/" + this.ssSelectedFixture.id +
          "/modes/" + this.ssSelectedModeId + "/channels"
        );
        this.ssChannels = await res.json();
        this.channelCount = this.ssChannels.length;
      } catch {
        this.ssChannels = [];
      }
    },

    async importSsFixture() {
      if (this.addressError || !this.fixtureName || !this.ssSelectedModeId) return;

      try {
        var res = await fetch(
          "/soundswitch/fixtures/" + this.ssSelectedFixture.id +
          "/modes/" + this.ssSelectedModeId + "/import",
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
}
