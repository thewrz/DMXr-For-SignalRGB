function dmxrLogPanel() {
  var LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };
  var MAX_ENTRIES = 500;

  return {
    logPanelOpen: false,
    logPanelEntries: [],
    logLevelFilter: "info",
    _logStreamSource: null,
    logPanelLastOpenedAt: null,
    logPanelUdpActive: false,
    logPanelUptime: "",

    get filteredLogEntries() {
      var maxRank = LEVEL_RANK[this.logLevelFilter] ?? 2;
      return this.logPanelEntries.filter(function (e) {
        return LEVEL_RANK[e.level] <= maxRank;
      });
    },

    get statusDotClass() {
      if (!this.serverOnline) return "dot-error";
      if (this.dmxConnectionState === "disconnected") return "dot-warn";
      if (this.dmxConnectionState === "reconnecting") return "dot-warn";
      return "dot-ok";
    },

    get statusSummaryText() {
      if (!this.serverOnline) return "Offline";
      var dmx =
        this.dmxConnectionState === "connected"
          ? "DMX OK"
          : this.dmxConnectionState === "reconnecting"
            ? "Reconnecting"
            : "DMX Off";
      return "Online \u00b7 " + dmx;
    },

    get unreadErrorCount() {
      if (!this.logPanelLastOpenedAt) {
        return this.logPanelEntries.filter(function (e) {
          return e.level === "error";
        }).length;
      }
      var since = this.logPanelLastOpenedAt;
      return this.logPanelEntries.filter(function (e) {
        return e.level === "error" && e.timestamp > since;
      }).length;
    },

    toggleLogPanel() {
      this.logPanelOpen = !this.logPanelOpen;
      if (this.logPanelOpen) {
        this.logPanelLastOpenedAt = new Date().toISOString();
        this.fetchLogHistory();
        this.fetchLogPanelHealth();
        this.initLogStream();
      } else {
        this.disconnectLogStream();
      }
    },

    closeLogPanel() {
      this.logPanelOpen = false;
      this.disconnectLogStream();
    },

    async fetchLogPanelHealth() {
      try {
        var res = await fetch("/health");
        if (res.ok) {
          var data = await res.json();
          this.logPanelUdpActive = !!(data.udp && data.udp.packetsReceived > 0);
          if (data.uptimeSeconds != null) {
            var s = Math.floor(data.uptimeSeconds);
            var h = Math.floor(s / 3600);
            var m = Math.floor((s % 3600) / 60);
            this.logPanelUptime = h > 0 ? h + "h " + m + "m" : m + "m";
          }
        }
      } catch (_) {
        // silent
      }
    },

    async fetchLogHistory() {
      try {
        var res = await fetch("/api/logs?limit=" + MAX_ENTRIES);
        if (res.ok) {
          this.logPanelEntries = await res.json();
        }
      } catch (_) {
        // silent — stream will fill entries
      }
    },

    initLogStream() {
      this.disconnectLogStream();
      var self = this;
      var src = new EventSource("/api/logs/stream");
      src.onmessage = function (e) {
        var entry = JSON.parse(e.data);
        self.logPanelEntries.unshift(entry);
        if (self.logPanelEntries.length > MAX_ENTRIES) {
          self.logPanelEntries.pop();
        }
      };
      src.onerror = function () {
        // SSE auto-reconnects
      };
      this._logStreamSource = src;
    },

    disconnectLogStream() {
      if (this._logStreamSource) {
        this._logStreamSource.close();
        this._logStreamSource = null;
      }
    },

    copyLogEntries() {
      var lines = this.filteredLogEntries.map(function (e) {
        return (
          "[" + e.timestamp + "] [" + e.level.toUpperCase() + "] [" + e.source + "] " + e.message
        );
      });
      var text = lines.join("\n");
      navigator.clipboard.writeText(text).then(
        function () {
          if (typeof this.showToast === "function") {
            this.showToast("Copied " + lines.length + " log entries", "success");
          }
        }.bind(this),
      );
    },

    downloadLogEntries() {
      var lines = this.filteredLogEntries.map(function (e) {
        return (
          "[" + e.timestamp + "] [" + e.level.toUpperCase() + "] [" + e.source + "] " + e.message
        );
      });
      var text = lines.join("\n");
      var blob = new Blob([text], { type: "text/plain" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "dmxr-logs-" + new Date().toISOString().slice(0, 19).replace(/:/g, "-") + ".log";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    async clearLogEntries() {
      try {
        await fetch("/api/logs/clear", { method: "POST" });
        this.logPanelEntries = [];
      } catch (_) {
        // silent
      }
    },

    logLevelColor(level) {
      var colors = {
        error: "var(--danger)",
        warn: "var(--warning)",
        info: "var(--accent)",
        debug: "var(--text-dim)",
      };
      return colors[level] || "var(--text-dim)";
    },

    logLevelIcon(level) {
      var icons = {
        error: "\u2717",
        warn: "\u26a0",
        info: "\u2139",
        debug: "\u2022",
      };
      return icons[level] || "\u2022";
    },

    logRelativeTime(timestamp) {
      var now = Date.now();
      var then = new Date(timestamp).getTime();
      var diff = Math.max(0, now - then);
      if (diff < 1000) return "just now";
      if (diff < 60000) return Math.floor(diff / 1000) + "s ago";
      if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
      if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
      return Math.floor(diff / 86400000) + "d ago";
    },

    logSourceLabel(source) {
      var labels = {
        connection: "DMX",
        pipeline: "PIPE",
        server: "SRV",
        api: "API",
      };
      return labels[source] || source;
    },
  };
}
