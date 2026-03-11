/**
 * Fixture reset mixin for DMXr fixture manager.
 * Detects reset/maintenance channels and sends DMX reset commands.
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrFixtureReset() {
  return {
    _resetPatterns: [/\breset\b/i, /\bmaintenance\b/i, /\blamp\s*control\b/i,
                     /\bspecial\b/i, /\bauto\s*mode\b/i, /\bcontrol\s*ch/i],
    _resettingFixtures: {},

    _findResetChannel(fixture) {
      if (fixture.resetConfig) {
        return fixture.channels.find(function(ch) {
          return ch.offset === fixture.resetConfig.channelOffset;
        });
      }
      var patterns = this._resetPatterns;
      for (var p = 0; p < patterns.length; p++) {
        for (var i = 0; i < fixture.channels.length; i++) {
          var ch = fixture.channels[i];
          if (ch.type === "Generic" && patterns[p].test(ch.name)) return ch;
        }
      }
      return null;
    },

    hasResetChannel(fixture) {
      return this._findResetChannel(fixture) !== null;
    },

    getResetChannelName(fixture) {
      var ch = this._findResetChannel(fixture);
      return ch ? ch.name : "";
    },

    isResetting(fixtureId) {
      return !!this._resettingFixtures[fixtureId];
    },

    async resetFixture(fixtureId) {
      if (this._resettingFixtures[fixtureId]) return;
      if (!confirm("Send DMX reset command? The fixture will re-home its motors.")) return;

      this._resettingFixtures[fixtureId] = true;
      try {
        var res = await fetch("/fixtures/" + fixtureId + "/reset", { method: "POST" });
        if (res.ok) {
          var data = await res.json();
          var self = this;
          setTimeout(function() {
            self._resettingFixtures[fixtureId] = false;
          }, data.holdMs || 5000);
        } else {
          var err = await res.json().catch(function() { return {}; });
          alert("Reset failed: " + (err.error || "Unknown error"));
          this._resettingFixtures[fixtureId] = false;
        }
      } catch {
        alert("Reset failed: network error");
        this._resettingFixtures[fixtureId] = false;
      }
    },
  };
}
