function dmxrConnectionLog() {
  return {
    showConnectionLog: false,
    connectionLogEvents: [],
    connectionLogLoading: false,
    connectionLogError: "",
    _connLogSource: null,

    initConnectionStream() {
      this.connectConnectionLogStream();
    },

    openConnectionLog() {
      this.showConnectionLog = true;
      this.connectionLogError = "";
      this.loadConnectionLog();
    },

    closeConnectionLog() {
      this.showConnectionLog = false;
    },

    async loadConnectionLog() {
      this.connectionLogLoading = true;
      try {
        var res = await fetch("/api/diagnostics/connection-log");
        if (!res.ok) throw new Error("Failed to load connection log");
        this.connectionLogEvents = await res.json();
      } catch (e) {
        this.connectionLogError = e.message;
      } finally {
        this.connectionLogLoading = false;
      }
    },

    connectConnectionLogStream() {
      this.disconnectConnectionLogStream();
      var src = new EventSource("/api/diagnostics/connection-log/stream");
      src.onmessage = function (e) {
        var event = JSON.parse(e.data);
        this.connectionLogEvents.unshift(event);
        if (this.connectionLogEvents.length > 200) {
          this.connectionLogEvents.pop();
        }
        // Update DMX hardware state reactively
        if (event.type === "connected" || event.type === "disconnected" || event.type === "reconnecting") {
          this.dmxConnectionState = event.type;
        }
        // Update control mode immediately
        if (event.type === "control_mode_changed" && event.details && event.details.controlMode) {
          this.controlMode = event.details.controlMode;
          this.overrideActive = event.details.controlMode !== "normal";
        }
      }.bind(this);
      src.onerror = function () {
        // SSE auto-reconnects; no action needed
      };
      this._connLogSource = src;
    },

    disconnectConnectionLogStream() {
      if (this._connLogSource) {
        this._connLogSource.close();
        this._connLogSource = null;
      }
    },

    async clearConnectionLog() {
      try {
        await fetch("/api/diagnostics/connection-log/clear", { method: "POST" });
        this.connectionLogEvents = [];
      } catch (e) {
        this.connectionLogError = e.message;
      }
    },

    connLogEventColor(type) {
      var colors = {
        connected: "var(--success)",
        reconnect_success: "var(--success)",
        disconnected: "var(--danger)",
        reconnect_failed: "var(--danger)",
        reconnecting: "var(--warning)",
        port_changed: "var(--accent)",
        control_mode_changed: "var(--warning)",
      };
      return colors[type] || "var(--text-dim)";
    },

    connLogEventIcon(type) {
      var icons = {
        connected: "\u2713",
        reconnect_success: "\u2713",
        disconnected: "\u2717",
        reconnect_failed: "\u2717",
        reconnecting: "\u21BB",
        port_changed: "\u2194",
        control_mode_changed: "\u25C9",
      };
      return icons[type] || "\u2022";
    },

    connLogRelativeTime(timestamp) {
      var now = Date.now();
      var then = new Date(timestamp).getTime();
      var diff = Math.max(0, now - then);
      if (diff < 1000) return "just now";
      if (diff < 60000) return Math.floor(diff / 1000) + "s ago";
      if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
      if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
      return Math.floor(diff / 86400000) + "d ago";
    },

    connLogEventLabel(type) {
      var labels = {
        connected: "Connected",
        disconnected: "Disconnected",
        reconnecting: "Reconnecting",
        reconnect_failed: "Reconnect Failed",
        reconnect_success: "Reconnect Success",
        port_changed: "Port Changed",
        control_mode_changed: "Control Mode Changed",
      };
      return labels[type] || type;
    },
  };
}
