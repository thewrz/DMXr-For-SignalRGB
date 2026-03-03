function dmxrLatency() {
  return {
    showLatency: false,
    latencyLoading: false,
    latencyError: "",
    latencyPollTimer: null,

    // Metrics data
    packetsPerSecond: 0,
    networkLatency: null,
    colorMapLatency: null,
    dmxSendLatency: null,
    totalLatency: null,

    // UDP stats
    udpPacketsReceived: 0,
    udpPacketsProcessed: 0,
    udpParseErrors: 0,
    udpSequenceGaps: 0,

    openLatency() {
      this.showLatency = true;
      this.pollLatency();
      this.latencyPollTimer = setInterval(this.pollLatency.bind(this), 1000);
    },

    closeLatency() {
      this.showLatency = false;
      if (this.latencyPollTimer) {
        clearInterval(this.latencyPollTimer);
        this.latencyPollTimer = null;
      }
    },

    async pollLatency() {
      try {
        var res = await fetch("/metrics");
        if (!res.ok) {
          this.latencyError = "Failed to fetch metrics (HTTP " + res.status + ")";
          return;
        }
        var data = await res.json();
        this.latencyError = "";

        // Latency stats
        var lat = data.latency;
        this.packetsPerSecond = lat.packetsPerSecond;
        this.networkLatency = lat.network;
        this.colorMapLatency = lat.colorMap;
        this.dmxSendLatency = lat.dmxSend;
        this.totalLatency = lat.totalProcessing;

        // UDP stats
        if (data.udp) {
          this.udpPacketsReceived = data.udp.packetsReceived;
          this.udpPacketsProcessed = data.udp.packetsProcessed;
          this.udpParseErrors = data.udp.parseErrors;
          this.udpSequenceGaps = data.udp.sequenceGaps;
        }
      } catch (e) {
        this.latencyError = "Could not connect to server.";
      }
    },

    formatMs(value) {
      if (value === undefined || value === null) return "--";
      if (value < 0.01) return "<0.01";
      if (value < 1) return value.toFixed(2);
      if (value < 10) return value.toFixed(1);
      return Math.round(value).toString();
    },

    barWidth(value, maxMs) {
      if (!value || !maxMs) return "0%";
      var pct = Math.min(100, (value / maxMs) * 100);
      return pct + "%";
    },

    maxBarValue() {
      var vals = [
        this.networkLatency?.avg,
        this.colorMapLatency?.avg,
        this.dmxSendLatency?.avg,
        this.totalLatency?.avg,
      ].filter(function(v) { return v != null && v > 0; });
      if (vals.length === 0) return 10;
      return Math.max.apply(null, vals) * 1.1; // 10% headroom
    },

    lossRate() {
      if (this.udpPacketsReceived === 0) return "0%";
      var dropped = this.udpPacketsReceived - this.udpPacketsProcessed;
      return ((dropped / this.udpPacketsReceived) * 100).toFixed(1) + "%";
    },
  };
}
