function dmxrDmxMonitor() {
  return {
    showMonitor: false,
    monitorLoading: false,
    monitorError: "",
    monitorPaused: false,
    monitorView: "grid",  // "grid" or "fixture"
    monitorChannels: {},
    monitorFixtures: [],
    monitorBlackoutActive: false,
    monitorActiveCount: 0,
    monitorTimestamp: null,
    monitorRevision: 0,

    // Universe selection
    monitorUniverseId: "",  // empty = default
    monitorUniverses: [],   // [{id, name}] from /universes

    // SSE connection
    _monitorSource: null,
    // rAF coalescing — buffer latest frame, apply on next paint
    _pendingFrame: null,
    _rafId: null,
    // Pre-built grid array (created once, updated in-place)
    _gridArray: null,

    openMonitor() {
      this.showMonitor = true;
      this.monitorError = "";
      this.loadMonitorUniverses();
      this.connectMonitor();
    },

    closeMonitor() {
      this.showMonitor = false;
      this.disconnectMonitor();
    },

    async loadMonitorUniverses() {
      try {
        var res = await fetch("/universes");
        if (res.ok) {
          this.monitorUniverses = await res.json();
        }
      } catch (e) {
        // Non-critical — dropdown just won't show extra universes
      }
    },

    monitorStreamUrl() {
      var url = "/api/dmx/monitor";
      if (this.monitorUniverseId) {
        url += "?universeId=" + encodeURIComponent(this.monitorUniverseId);
      }
      return url;
    },

    switchMonitorUniverse(universeId) {
      this.monitorUniverseId = universeId;
      if (!this.monitorPaused) {
        this.connectMonitor();
      }
      if (this.monitorView === "fixture") {
        this.loadGroupedSnapshot();
      }
    },

    connectMonitor() {
      this.disconnectMonitor();
      this.monitorLoading = true;
      this.monitorPaused = false;

      try {
        var source = new EventSource(this.monitorStreamUrl());
        var self = this;

        source.onmessage = function(event) {
          self.monitorLoading = false;
          try {
            self._pendingFrame = JSON.parse(event.data);
            if (!self._rafId) {
              self._rafId = requestAnimationFrame(function() {
                self._rafId = null;
                if (self._pendingFrame) {
                  self._applyFrame(self._pendingFrame);
                  self._pendingFrame = null;
                }
              });
            }
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
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      this._pendingFrame = null;
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
        var url = "/api/dmx/snapshot?grouped=true";
        if (this.monitorUniverseId) {
          url += "&universeId=" + encodeURIComponent(this.monitorUniverseId);
        }
        var res = await fetch(url);
        if (res.ok) {
          var data = await res.json();
          this.monitorFixtures = data.fixtures || [];
        }
      } catch (e) {
        // Silently ignore — fixture grouping is supplementary
      }
    },

    // Apply a frame with delta detection — only update changed channels
    _applyFrame(frame) {
      var prev = this.monitorChannels;
      var next = frame.channels;
      var changed = false;
      for (var i = 1; i <= 512; i++) {
        var newVal = next[i] || 0;
        var oldVal = prev[i] || 0;
        if (newVal !== oldVal) {
          prev[i] = newVal;
          changed = true;
        }
      }
      this.monitorBlackoutActive = frame.blackoutActive;
      this.monitorActiveCount = frame.activeChannelCount;
      this.monitorTimestamp = frame.timestamp;
      if (changed) {
        this.monitorRevision++;
      }
    },

    // Pre-built 512-element array, updated in-place to avoid Alpine re-rendering all x-for bindings
    gridChannels() {
      if (!this._gridArray) {
        this._gridArray = [];
        for (var i = 1; i <= 512; i++) {
          this._gridArray.push({ address: i, value: 0 });
        }
      }
      // Touch monitorRevision so Alpine tracks this as a dependency
      void this.monitorRevision;
      for (var i = 0; i < 512; i++) {
        this._gridArray[i].value = this.monitorChannels[i + 1] || 0;
      }
      return this._gridArray;
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
