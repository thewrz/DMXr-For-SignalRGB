/**
 * Color calibration mixin for DMXr fixture manager.
 * Per-fixture RGB gain/offset adjustment with debounced server sync.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrColorCalibration() {
  return {
    hasColorChannels(fixture) {
      return fixture.channels.some(function(ch) {
        return ch.type === "ColorIntensity" &&
          (ch.color === "Red" || ch.color === "Green" || ch.color === "Blue");
      });
    },

    getCalGain(fixture, channel) {
      if (!fixture.colorCalibration) return 1.0;
      return fixture.colorCalibration.gain[channel];
    },

    getCalOffset(fixture, channel) {
      if (!fixture.colorCalibration) return 0;
      return fixture.colorCalibration.offset[channel];
    },

    setCalGain(fixtureId, channel, value) {
      var self = this;
      var key = "cal-gain:" + fixtureId + ":" + channel;
      if (self.overrideTimers[key]) {
        clearTimeout(self.overrideTimers[key]);
      }
      var fixture = self.fixtures.find(function(f) { return f.id === fixtureId; });
      if (!fixture) return;
      var parsed = parseFloat(value);
      if (!fixture.colorCalibration) {
        fixture.colorCalibration = {
          gain: { r: 1.0, g: 1.0, b: 1.0 },
          offset: { r: 0, g: 0, b: 0 },
        };
      }
      fixture.colorCalibration = {
        gain: Object.assign({}, fixture.colorCalibration.gain, (function() { var o = {}; o[channel] = parsed; return o; })()),
        offset: fixture.colorCalibration.offset,
      };
      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        var f = self.fixtures.find(function(f) { return f.id === fixtureId; });
        if (!f) return;
        self.patchFixture(fixtureId, { colorCalibration: f.colorCalibration });
      }, 300);
    },

    setCalOffset(fixtureId, channel, value) {
      var self = this;
      var key = "cal-offset:" + fixtureId + ":" + channel;
      if (self.overrideTimers[key]) {
        clearTimeout(self.overrideTimers[key]);
      }
      var fixture = self.fixtures.find(function(f) { return f.id === fixtureId; });
      if (!fixture) return;
      var parsed = parseInt(value, 10);
      if (!fixture.colorCalibration) {
        fixture.colorCalibration = {
          gain: { r: 1.0, g: 1.0, b: 1.0 },
          offset: { r: 0, g: 0, b: 0 },
        };
      }
      fixture.colorCalibration = {
        gain: fixture.colorCalibration.gain,
        offset: Object.assign({}, fixture.colorCalibration.offset, (function() { var o = {}; o[channel] = parsed; return o; })()),
      };
      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        var f = self.fixtures.find(function(f) { return f.id === fixtureId; });
        if (!f) return;
        self.patchFixture(fixtureId, { colorCalibration: f.colorCalibration });
      }, 300);
    },

    resetCalibration(fixtureId) {
      var cal = {
        gain: { r: 1.0, g: 1.0, b: 1.0 },
        offset: { r: 0, g: 0, b: 0 },
      };
      var fixture = this.fixtures.find(function(f) { return f.id === fixtureId; });
      if (fixture) fixture.colorCalibration = cal;
      this.patchFixture(fixtureId, { colorCalibration: cal });
    },
  };
}
