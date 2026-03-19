function dmxrConnectionLog() {
  return {
    connectionLogEvents: [],
    _connLogSource: null,

    initConnectionStream() {
      this.connectConnectionLogStream();
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
  };
}
