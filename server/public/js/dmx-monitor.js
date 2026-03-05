function dmxrDmxMonitor() {
  return {
    showMonitor: false,
    monitorLoading: false,
    monitorError: "",
    monitorPaused: false,
    monitorView: "grid",  // "grid" or "fixture"
    monitorFps: 10,
    monitorChannels: {},
    monitorFixtures: [],
    monitorBlackoutActive: false,
    monitorActiveCount: 0,
    monitorTimestamp: null,

    // SSE connection
    _monitorSource: null,

    openMonitor() {
      this.showMonitor = true;
      this.monitorError = "";
      this.connectMonitor();
    },

    closeMonitor() {
      this.showMonitor = false;
      this.disconnectMonitor();
    },

    connectMonitor() {
      this.disconnectMonitor();
      this.monitorLoading = true;
      this.monitorPaused = false;

      try {
        var source = new EventSource("/api/dmx/monitor");
        var self = this;

        source.onmessage = function(event) {
          self.monitorLoading = false;
          try {
            var frame = JSON.parse(event.data);
            self.monitorChannels = frame.channels;
            self.monitorBlackoutActive = frame.blackoutActive;
            self.monitorActiveCount = frame.activeChannelCount;
            self.monitorTimestamp = frame.timestamp;
          } catch (e) {
            self.monitorError = "Failed to parse frame data";
          }
        };

        source.onerror = function() {
          self.monitorLoading = false;
          if (source.readyState === EventSource.CLOSED) {
            self.monitorError = "Connection closed";
          }
        };

        this._monitorSource = source;
      } catch (e) {
        this.monitorLoading = false;
        this.monitorError = "Could not connect to monitor stream";
      }
    },

    disconnectMonitor() {
      if (this._monitorSource) {
        this._monitorSource.close();
        this._monitorSource = null;
      }
    },

    toggleMonitorPause() {
      this.monitorPaused = !this.monitorPaused;
      if (this.monitorPaused) {
        this.disconnectMonitor();
      } else {
        this.connectMonitor();
      }
    },

    async loadGroupedSnapshot() {
      try {
        var res = await fetch("/api/dmx/snapshot?grouped=true");
        if (res.ok) {
          var data = await res.json();
          this.monitorFixtures = data.fixtures || [];
        }
      } catch (e) {
        // Silently ignore — fixture grouping is supplementary
      }
    },

    // Build a flat array of 512 channels for the grid view
    gridChannels() {
      var channels = [];
      for (var i = 1; i <= 512; i++) {
        channels.push({
          address: i,
          value: this.monitorChannels[i] || 0,
        });
      }
      return channels;
    },

    channelIntensity(value) {
      if (!value) return "background: var(--surface2);";
      var pct = value / 255;
      var r = Math.round(0 + pct * 0);
      var g = Math.round(184 * pct);
      var b = Math.round(212 * pct);
      return "background: rgba(" + r + "," + g + "," + b + "," + (0.15 + pct * 0.85) + ");";
    },

    channelTextColor(value) {
      return value > 0 ? "color: var(--text);" : "color: var(--text-dim);";
    },
  };
}
