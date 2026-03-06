function dmxrColorSwatch() {
  return {
    fixtureColors: {},
    _colorEventSource: null,
    _colorRafPending: false,
    _colorLatestData: null,

    startColorStream: function () {
      var self = this;
      if (self._colorEventSource) return;

      self._colorEventSource = new EventSource("/api/fixtures/colors/stream");
      self._colorEventSource.onmessage = function (e) {
        self._colorLatestData = e.data;
        if (!self._colorRafPending) {
          self._colorRafPending = true;
          requestAnimationFrame(function () {
            self._colorRafPending = false;
            if (!self._colorLatestData) return;
            try {
              var parsed = JSON.parse(self._colorLatestData);
              var map = {};
              for (var i = 0; i < parsed.fixtures.length; i++) {
                var f = parsed.fixtures[i];
                map[f.id] = f.color;
              }
              self.fixtureColors = map;
            } catch (err) {
              // ignore parse errors
            }
          });
        }
      };

      document.addEventListener("visibilitychange", self._colorVisHandler = function () {
        if (document.hidden) {
          self.stopColorStream();
        } else {
          self.startColorStream();
        }
      });
    },

    stopColorStream: function () {
      if (this._colorEventSource) {
        this._colorEventSource.close();
        this._colorEventSource = null;
      }
    },

    getSwatchStyle: function (fixtureId) {
      var c = this.fixtureColors[fixtureId];
      if (!c || !c.groups || !c.groups[0]) {
        return "background: var(--surface2)";
      }
      var g = c.groups[0];
      return "background: rgb(" + g.r + "," + g.g + "," + g.b + ")";
    },

    getSwatchTitle: function (fixtureId) {
      var c = this.fixtureColors[fixtureId];
      if (!c || !c.groups || !c.groups[0]) return "No data";
      var g = c.groups[0];
      var tip = "RGB(" + g.r + ", " + g.g + ", " + g.b + ")";
      if (g.w > 0) tip += " W:" + g.w;
      if (c.dimmer >= 0) tip += " Dim:" + c.dimmer;
      return tip;
    },

    isFixtureActive: function (fixtureId) {
      var c = this.fixtureColors[fixtureId];
      return c ? c.active : false;
    },

    getWhiteLevel: function (fixtureId) {
      var c = this.fixtureColors[fixtureId];
      if (!c || !c.groups || !c.groups[0]) return 0;
      return c.groups[0].w || 0;
    },
  };
}
