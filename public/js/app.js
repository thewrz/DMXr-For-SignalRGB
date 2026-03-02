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
  };

  return Object.assign(
    app,
    dmxrFixtureManager(),
    dmxrLibraryBrowser(),
    dmxrSearch(),
    dmxrDragDrop(),
  );
}
