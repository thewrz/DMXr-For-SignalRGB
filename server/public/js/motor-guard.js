/**
 * Motor guard mixin for DMXr fixture manager.
 * Clamps Pan/Tilt/Focus/Zoom overrides to safe ranges.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrMotorGuard() {
  return {
    _motorTypes: ["Pan", "Tilt", "Focus", "Zoom"],

    _isMotorChannel(fixture, ch) {
      return fixture.motorGuardEnabled !== false &&
             this._motorTypes.indexOf(ch.type) !== -1;
    },

    hasMotorChannels(fixture) {
      var self = this;
      return fixture.channels.some(function(ch) {
        return self._motorTypes.indexOf(ch.type) !== -1;
      });
    },

    getSliderMin(fixture, ch) {
      if (this._isMotorChannel(fixture, ch)) {
        var buffer = fixture.motorGuardBuffer ?? 4;
        return Math.max(ch.rangeMin || 0, Math.floor(buffer / 2));
      }
      return ch.rangeMin || 0;
    },

    getSliderMax(fixture, ch) {
      if (this._isMotorChannel(fixture, ch)) {
        var buffer = fixture.motorGuardBuffer ?? 4;
        return Math.min(ch.rangeMax || 255, 255 - Math.ceil(buffer / 2));
      }
      return ch.rangeMax || 255;
    },

    async toggleMotorGuard(fixtureId, enabled) {
      await this.patchFixture(fixtureId, { motorGuardEnabled: enabled });
    },

    setMotorGuardBuffer(fixtureId, value) {
      var self = this;
      var key = "mg:" + fixtureId;
      if (self.overrideTimers[key]) {
        clearTimeout(self.overrideTimers[key]);
      }
      var fixture = self.fixtures.find(function(f) { return f.id === fixtureId; });
      if (fixture) {
        fixture.motorGuardBuffer = parseInt(value, 10);
      }
      self.overrideTimers[key] = setTimeout(function() {
        delete self.overrideTimers[key];
        self.patchFixture(fixtureId, { motorGuardBuffer: parseInt(value, 10) });
      }, 250);
    },
  };
}
