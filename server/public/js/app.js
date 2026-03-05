function dmxrApp() {
  var app = {
    fixtures: [],
    serverOnline: false,
    controlMode: "normal",
    overrideActive: false,
    sidebarOpen: false,
    // Universe selection
    selectedUniverseId: "",
    availableUniverses: [],
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

    // Channel override UI
    expandedFixtureId: null,
    overrideTimers: {},

    async init() {
      await this.initControlMode();
      await this.loadUniverses();
      await this.loadFixtures();
      await this.loadManufacturers();
      await this.loadLibraries();
      await this.loadCustomTemplates();
      this.loadServerName();
      this.pollFixtures();
      await this.checkWizardNeeded();
    },
  };

  return Object.assign(
    app,
    dmxrFixtureManager(),
    dmxrLibraryBrowser(),
    dmxrSearch(),
    dmxrDragDrop(),
    dmxrSettings(),
    dmxrLatency(),
    dmxrSetupWizard(),
    dmxrCustomFixture(),
    dmxrFixtureIcons(),
    dmxrDmxMonitor(),
  );
}
