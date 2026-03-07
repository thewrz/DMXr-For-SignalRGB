/**
 * Movement control panel mixin for DMXr.
 * Provides XY pad jog, speed/curve config, and home/stop controls
 * for fixtures with Pan/Tilt channels.
 */
function dmxrMovement() {
  return {
    movementFixtureId: null,
    movementData: null,
    movementPollTimer: null,
    movementDragging: false,

    hasPanTilt(fixture) {
      if (!fixture || !fixture.channels) return false;
      return fixture.channels.some(function(ch) {
        return ch.type === "Pan" || ch.type === "Tilt";
      });
    },

    async openMovement(fixtureId) {
      this.movementFixtureId = fixtureId;
      await this.loadMovementState(fixtureId);
      this.startMovementPoll();
    },

    closeMovement() {
      this.stopMovementPoll();
      this.movementFixtureId = null;
      this.movementData = null;
    },

    async loadMovementState(fixtureId) {
      try {
        var res = await fetch("/fixtures/" + fixtureId + "/movement");
        if (res.ok) {
          this.movementData = await res.json();
        }
      } catch {
        // Will retry on next poll
      }
    },

    startMovementPoll() {
      var self = this;
      this.stopMovementPoll();
      this.movementPollTimer = setInterval(function() {
        if (self.movementFixtureId) {
          self.loadMovementState(self.movementFixtureId);
        }
      }, 200);
    },

    stopMovementPoll() {
      if (this.movementPollTimer) {
        clearInterval(this.movementPollTimer);
        this.movementPollTimer = null;
      }
    },

    async updateMovementConfig(fixtureId, configPatch) {
      try {
        var res = await fetch("/fixtures/" + fixtureId + "/movement", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configPatch),
        });
        if (res.ok) {
          this.movementData = Object.assign({}, this.movementData, {
            config: await res.json(),
          });
        }
      } catch {
        // Non-critical
      }
    },

    async jogMovement(fixtureId, pan, tilt) {
      try {
        await fetch("/fixtures/" + fixtureId + "/movement/target", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pan: pan, tilt: tilt }),
        });
      } catch {
        // Non-critical
      }
    },

    async homeMovement(fixtureId) {
      try {
        await fetch("/fixtures/" + fixtureId + "/movement/home", {
          method: "POST",
        });
      } catch {
        // Non-critical
      }
    },

    async stopMovement(fixtureId) {
      try {
        await fetch("/fixtures/" + fixtureId + "/movement/stop", {
          method: "POST",
        });
      } catch {
        // Non-critical
      }
    },

    movementCurrentPan() {
      if (!this.movementData || !this.movementData.state) return 128;
      return Math.round(this.movementData.state.currentPan / 256);
    },

    movementCurrentTilt() {
      if (!this.movementData || !this.movementData.state) return 128;
      return Math.round(this.movementData.state.currentTilt / 256);
    },

    movementTargetPan() {
      if (!this.movementData || !this.movementData.state) return 128;
      return Math.round(this.movementData.state.targetPan / 256);
    },

    movementTargetTilt() {
      if (!this.movementData || !this.movementData.state) return 128;
      return Math.round(this.movementData.state.targetTilt / 256);
    },

    movementEnabled() {
      return this.movementData && this.movementData.config && this.movementData.config.enabled;
    },

    movementVelocity() {
      if (!this.movementData || !this.movementData.config) return 50;
      return this.movementData.config.maxVelocity;
    },

    movementCurve() {
      if (!this.movementData || !this.movementData.config) return "ease-in-out";
      return this.movementData.config.smoothingCurve;
    },

    movementPreset() {
      if (!this.movementData || !this.movementData.config) return "moving-head";
      return this.movementData.config.preset;
    },

    movementIsMoving() {
      return this.movementData && this.movementData.state && this.movementData.state.isMoving;
    },

    // XY pad interaction
    handleXYPadClick(event) {
      if (!this.movementFixtureId) return;
      var rect = event.currentTarget.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      var y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      var pan = Math.round(x * 255);
      var tilt = Math.round(y * 255);
      this.jogMovement(this.movementFixtureId, pan, tilt);
    },

    handleXYPadMouseDown(event) {
      this.movementDragging = true;
      this.handleXYPadClick(event);
    },

    handleXYPadMouseMove(event) {
      if (!this.movementDragging) return;
      this.handleXYPadClick(event);
    },

    handleXYPadMouseUp() {
      this.movementDragging = false;
    },

    // Position dot CSS (current = cyan, target = orange)
    currentDotStyle() {
      var pan = this.movementCurrentPan();
      var tilt = this.movementCurrentTilt();
      return "left:" + (pan / 255 * 100) + "%;top:" + (tilt / 255 * 100) + "%";
    },

    targetDotStyle() {
      var pan = this.movementTargetPan();
      var tilt = this.movementTargetTilt();
      return "left:" + (pan / 255 * 100) + "%;top:" + (tilt / 255 * 100) + "%";
    },

    setMovementVelocity(value) {
      this.updateMovementConfig(this.movementFixtureId, { maxVelocity: parseInt(value, 10) });
    },

    setMovementCurve(value) {
      this.updateMovementConfig(this.movementFixtureId, { smoothingCurve: value });
    },

    setMovementPreset(value) {
      var presets = {
        "moving-head": { maxVelocity: 50, maxAcceleration: 100, smoothingCurve: "ease-in-out" },
        "scanner": { maxVelocity: 100, maxAcceleration: 200, smoothingCurve: "s-curve" },
        "laser": { maxVelocity: 255, maxAcceleration: 1000, smoothingCurve: "linear" },
        "custom": {},
      };
      var patch = Object.assign({ preset: value }, presets[value] || {});
      this.updateMovementConfig(this.movementFixtureId, patch);
    },

    toggleMovementEnabled() {
      var current = this.movementEnabled();
      this.updateMovementConfig(this.movementFixtureId, { enabled: !current });
    },
  };
}
