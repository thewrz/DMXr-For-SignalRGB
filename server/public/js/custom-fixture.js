/**
 * Custom fixture builder mixin for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */

var CHANNEL_TYPES = [
  "ColorIntensity",
  "Intensity",
  "Strobe",
  "ShutterStrobe",
  "Pan",
  "Tilt",
  "Focus",
  "Zoom",
  "Gobo",
  "Iris",
  "Prism",
  "ColorWheel",
  "NoFunction",
  "Generic",
];

var CHANNEL_COLORS = ["Red", "Green", "Blue", "White", "Amber", "UV", "Cyan", "Magenta", "Yellow"];

var FIXTURE_CATEGORIES = [
  "Color Changer",
  "Moving Head",
  "Scanner",
  "Dimmer",
  "Strobe",
  "Blinder",
  "Laser",
  "Effect",
  "Pixel Bar",
  "Blacklight",
  "Smoke Machine",
  "Other",
];

function dmxrCustomFixture() {
  return {
    // Custom fixture state
    customStep: 0,       // 0=list, 1=info, 2=channels, 3=review
    customTemplates: [],
    customName: "",
    customManufacturer: "",
    customCategory: "Color Changer",
    customModeName: "",
    customChannels: [],
    customError: "",
    customEditId: null,

    // Constants exposed for templates
    channelTypes: CHANNEL_TYPES,
    channelColors: CHANNEL_COLORS,
    fixtureCategories: FIXTURE_CATEGORIES,

    async loadCustomTemplates() {
      try {
        var res = await fetch("/user-fixtures");
        if (res.ok) {
          this.customTemplates = await res.json();
        }
      } catch {
        this.customTemplates = [];
      }
    },

    startCustomCreate() {
      this.customEditId = null;
      this.customName = "";
      this.customManufacturer = "";
      this.customCategory = "Color Changer";
      this.customModeName = "";
      this.customChannels = [];
      this.customError = "";
      this.customStep = 1;
    },

    startCustomEdit(template) {
      this.customEditId = template.id;
      this.customName = template.name;
      this.customManufacturer = template.manufacturer;
      this.customCategory = template.category;
      // Load first mode for editing
      var mode = template.modes[0];
      this.customModeName = mode ? mode.name : "";
      this.customChannels = mode ? mode.channels.map(function(ch) {
        return {
          offset: ch.offset,
          name: ch.name,
          type: ch.type,
          color: ch.color || "",
          defaultValue: ch.defaultValue,
        };
      }) : [];
      this.customError = "";
      this.customStep = 1;
    },

    customInfoNext() {
      if (!this.customName.trim()) {
        this.customError = "Name is required";
        return;
      }
      if (!this.customManufacturer.trim()) {
        this.customError = "Manufacturer is required";
        return;
      }
      this.customError = "";
      if (this.customChannels.length === 0) {
        this.addCustomChannel();
      }
      if (!this.customModeName) {
        this.customModeName = this.customChannels.length + "-channel";
      }
      this.customStep = 2;
    },

    addCustomChannel() {
      var offset = this.customChannels.length;
      this.customChannels = this.customChannels.concat([{
        offset: offset,
        name: "",
        type: "ColorIntensity",
        color: "Red",
        defaultValue: 0,
      }]);
    },

    removeCustomChannel(index) {
      this.customChannels = this.customChannels
        .filter(function(_, i) { return i !== index; })
        .map(function(ch, i) { return Object.assign({}, ch, { offset: i }); });
    },

    moveCustomChannel(index, direction) {
      var newIndex = index + direction;
      if (newIndex < 0 || newIndex >= this.customChannels.length) return;
      var arr = this.customChannels.slice();
      var temp = arr[index];
      arr[index] = arr[newIndex];
      arr[newIndex] = temp;
      this.customChannels = arr.map(function(ch, i) {
        return Object.assign({}, ch, { offset: i });
      });
    },

    onCustomTypeChange(index) {
      var ch = this.customChannels[index];
      if (ch.type !== "ColorIntensity") {
        this.customChannels = this.customChannels.map(function(c, i) {
          return i === index ? Object.assign({}, c, { color: "" }) : c;
        });
      } else if (!ch.color) {
        this.customChannels = this.customChannels.map(function(c, i) {
          return i === index ? Object.assign({}, c, { color: "Red" }) : c;
        });
      }
      // Auto-name if empty
      if (!ch.name) {
        var autoName = ch.type === "ColorIntensity" ? ch.color : ch.type;
        this.customChannels = this.customChannels.map(function(c, i) {
          return i === index ? Object.assign({}, c, { name: autoName || "" }) : c;
        });
      }
    },

    customChannelsNext() {
      if (this.customChannels.length === 0) {
        this.customError = "Add at least one channel";
        return;
      }
      for (var i = 0; i < this.customChannels.length; i++) {
        if (!this.customChannels[i].name.trim()) {
          this.customError = "Channel " + (i + 1) + " needs a name";
          return;
        }
      }
      if (!this.customModeName.trim()) {
        this.customModeName = this.customChannels.length + "-channel";
      }
      this.customError = "";
      this.customStep = 3;
    },

    async saveCustomFixture() {
      this.customError = "";

      var channels = this.customChannels.map(function(ch) {
        var out = {
          offset: ch.offset,
          name: ch.name,
          type: ch.type,
          defaultValue: ch.defaultValue,
        };
        if (ch.type === "ColorIntensity" && ch.color) {
          out.color = ch.color;
        }
        return out;
      });

      var payload = {
        name: this.customName.trim(),
        manufacturer: this.customManufacturer.trim(),
        category: this.customCategory,
        modes: [{
          name: this.customModeName.trim() || (channels.length + "-channel"),
          channels: channels,
        }],
      };

      try {
        var url = this.customEditId
          ? "/user-fixtures/" + this.customEditId
          : "/user-fixtures";
        var method = this.customEditId ? "PATCH" : "POST";

        var res = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          var data = await res.json();
          this.customError = data.error || "Save failed";
          return;
        }

        var saved = await res.json();
        await this.loadCustomTemplates();
        await this.loadLibraries();

        // Auto-stage for grid placement
        var mode = saved.modes[0];
        this.stagedFixture = {
          name: saved.name,
          source: "custom",
          mode: mode.name,
          channelCount: mode.channels.length,
          channels: mode.channels,
        };
        this.customStep = 0;
      } catch (err) {
        this.customError = "Network error saving fixture";
      }
    },

    async deleteCustomTemplate(id) {
      try {
        var res = await fetch("/user-fixtures/" + id, { method: "DELETE" });
        if (res.ok) {
          await this.loadCustomTemplates();
          await this.loadLibraries();
        }
      } catch {
        // ignore
      }
    },

    stageCustomTemplate(template) {
      var mode = template.modes[0];
      if (!mode) return;

      this.fixtureName = template.name;
      this.stagedFixture = {
        name: template.name,
        source: "custom",
        mode: mode.name,
        channelCount: mode.channels.length,
        channels: mode.channels,
      };
    },
  };
}
