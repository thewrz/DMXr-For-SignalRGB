/**
 * Shared OFL import/export utilities for DMXr.
 * Used by custom-fixture.js and library-browser.js.
 */

var OFL_SCHEMA_URL = "https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/schemas/fixture.json";

/**
 * DMXr channel type → OFL capability object.
 */
var DMXR_TO_OFL_CAPABILITY = {
  ColorIntensity: function(ch) { return { type: "ColorIntensity", color: ch.color || "Red" }; },
  Intensity:      function() { return { type: "Intensity" }; },
  Pan:            function() { return { type: "Pan" }; },
  Tilt:           function() { return { type: "Tilt" }; },
  ShutterStrobe:  function() { return { type: "ShutterStrobe", shutterEffect: "Strobe" }; },
  Strobe:         function() { return { type: "ShutterStrobe", shutterEffect: "Strobe" }; },
  Gobo:           function() { return { type: "WheelSlot", wheel: "Gobo Wheel" }; },
  ColorWheel:     function() { return { type: "WheelSlot", wheel: "Color Wheel" }; },
  Focus:          function() { return { type: "Focus" }; },
  Zoom:           function() { return { type: "Zoom" }; },
  Iris:           function() { return { type: "Iris" }; },
  Prism:          function() { return { type: "Prism" }; },
  NoFunction:     function() { return { type: "NoFunction" }; },
  Generic:        function() { return { type: "Generic" }; },
};

/**
 * OFL capability type → DMXr channel type.
 * Types not in this map fall through to "Generic".
 */
var OFL_TO_DMXR_TYPE = {
  ColorIntensity: "ColorIntensity",
  Intensity:      "Intensity",
  Pan:            "Pan",
  Tilt:           "Tilt",
  Focus:          "Focus",
  Zoom:           "Zoom",
  Gobo:           "Gobo",
  WheelSlot:      "Generic",
  Iris:           "Iris",
  Prism:          "Prism",
  ColorWheel:     "ColorWheel",
  ShutterStrobe:  "ShutterStrobe",
  NoFunction:     "NoFunction",
  Generic:        "Generic",
};

/**
 * OFL category → DMXr category mapping.
 */
var OFL_TO_DMXR_CATEGORY = {
  "Color Changer": "Color Changer",
  "Moving Head":   "Moving Head",
  "Scanner":       "Scanner",
  "Laser":         "Laser",
  "Dimmer":        "Dimmer",
  "Strobe":        "Strobe",
  "Blinder":       "Blinder",
  "Effect":        "Effect",
  "Pixel Bar":     "Pixel Bar",
  "Smoke":         "Smoke Machine",
  "Hazer":         "Smoke Machine",
  "Barrel Scanner":"Scanner",
  "Fan":           "Other",
  "Matrix":        "Other",
  "Stand":         "Other",
  "Flower":        "Other",
  "Other":         "Other",
};

/**
 * DMXr category → OFL categories array.
 */
var DMXR_TO_OFL_CATEGORIES = {
  "Color Changer": ["Color Changer"],
  "Moving Head":   ["Moving Head"],
  "Scanner":       ["Scanner"],
  "Laser":         ["Laser"],
  "Dimmer":        ["Dimmer"],
  "Strobe":        ["Strobe"],
  "Blinder":       ["Blinder"],
  "Effect":        ["Effect"],
  "Pixel Bar":     ["Pixel Bar"],
  "Blacklight":    ["Color Changer"],
  "Smoke Machine": ["Smoke"],
  "Other":         ["Other"],
};

/**
 * Build a complete OFL JSON export object.
 * @param {string} name - fixture name
 * @param {string[]} oflCategories - OFL categories array
 * @param {Array<{name: string, channels: Array<{name: string, type: string, color?: string, defaultValue?: number}>}>} modes
 * @returns {Object} OFL fixture JSON
 */
function buildOflExportJson(name, oflCategories, modes) {
  var today = new Date().toISOString().split("T")[0];

  // Collect all unique channels across all modes
  var allChannels = {};
  var modesDef = [];
  var nameCounts = {};

  for (var m = 0; m < modes.length; m++) {
    var mode = modes[m];
    var modeChannelNames = [];

    for (var i = 0; i < mode.channels.length; i++) {
      var ch = mode.channels[i];
      var baseName = ch.name || ("Channel " + (i + 1));
      var uniqueName = baseName;

      if (nameCounts[baseName] !== undefined) {
        nameCounts[baseName]++;
        uniqueName = baseName + " " + nameCounts[baseName];
      } else {
        nameCounts[baseName] = 1;
      }

      if (!allChannels[uniqueName]) {
        var capFn = DMXR_TO_OFL_CAPABILITY[ch.type];
        var capability = capFn ? capFn(ch) : { type: "Generic" };
        var chDef = { capability: capability };
        if (typeof ch.defaultValue === "number" && ch.defaultValue !== 0) {
          chDef.defaultValue = ch.defaultValue;
        }
        allChannels[uniqueName] = chDef;
      }
      modeChannelNames.push(uniqueName);
    }

    modesDef.push({
      name: mode.name || (mode.channels.length + "-channel"),
      channels: modeChannelNames,
    });
  }

  return {
    $schema: OFL_SCHEMA_URL,
    name: name,
    categories: oflCategories,
    meta: {
      authors: ["DMXr Export"],
      createDate: today,
      lastModifyDate: today,
    },
    availableChannels: allChannels,
    modes: modesDef,
  };
}

/**
 * Trigger a browser download of a JSON object.
 * @param {Object} obj - object to serialize
 * @param {string} filename - download filename
 */
function triggerJsonDownload(obj, filename) {
  var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Slugify a string for use as a filename.
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Parse an OFL channel definition into DMXr channel format.
 * Reuses the same logic as fixture-manager.js buildChannelsPayload().
 * @param {string} chName - channel name from mode.channels
 * @param {Object} chDef - OFL availableChannels[chName]
 * @param {number} offset - DMX offset
 * @returns {{offset: number, name: string, type: string, color: string, defaultValue: number}}
 */
function parseOflChannelToDmxr(chName, chDef, offset) {
  var type = "NoFunction";
  var color = "";
  var defaultValue = 0;

  if (typeof chDef.defaultValue === "number") {
    defaultValue = chDef.defaultValue > 255
      ? Math.floor(chDef.defaultValue / 256)
      : Math.round(chDef.defaultValue);
  }

  if (chDef.capability && chDef.capability.type) {
    var oflType = chDef.capability.type;
    // Discriminate WheelSlot by wheel name for round-trip fidelity
    if (oflType === "WheelSlot" && chDef.capability.wheel) {
      var wheel = chDef.capability.wheel;
      type = wheel === "Gobo Wheel" ? "Gobo"
           : wheel === "Color Wheel" ? "ColorWheel"
           : "Generic";
    } else {
      type = OFL_TO_DMXR_TYPE[oflType] || "Generic";
    }
    color = chDef.capability.color || "";
  } else if (chDef.capabilities && chDef.capabilities.length > 0) {
    for (var j = 0; j < chDef.capabilities.length; j++) {
      if (chDef.capabilities[j].type) {
        var capType = chDef.capabilities[j].type;
        type = OFL_TO_DMXR_TYPE[capType] || "Generic";
        color = chDef.capabilities[j].color || "";
        break;
      }
    }
    // Multi-range channels are best represented as Generic
    if (chDef.capabilities.length > 1) {
      type = "Generic";
      color = "";
    }
  }

  // Validate color against known set
  var validColors = { Red: 1, Green: 1, Blue: 1, White: 1, Amber: 1, UV: 1, Cyan: 1, Magenta: 1, Yellow: 1 };
  if (type !== "ColorIntensity") {
    color = "";
  } else if (color && !validColors[color]) {
    color = "";
  }

  return {
    offset: offset,
    name: chName,
    type: type,
    color: color,
    defaultValue: defaultValue,
  };
}

/**
 * Convert an OFL fixture definition's mode channels to DMXr channel array.
 * @param {Object} availableChannels - OFL availableChannels object
 * @param {string[]} modeChannels - mode.channels array (may contain nulls)
 * @returns {Array<{offset: number, name: string, type: string, color: string, defaultValue: number}>}
 */
function buildDmxrChannelsFromOfl(availableChannels, modeChannels) {
  var channels = [];
  var offset = 0;

  for (var i = 0; i < modeChannels.length; i++) {
    var chName = modeChannels[i];
    if (chName === null) continue;

    var chDef = availableChannels[chName] || {};
    channels.push(parseOflChannelToDmxr(chName, chDef, offset));
    offset++;
  }

  return channels;
}

/**
 * Map OFL categories array to best DMXr category.
 * @param {string[]} oflCategories
 * @returns {string}
 */
function mapOflCategoryToDmxr(oflCategories) {
  if (!oflCategories || oflCategories.length === 0) return "Other";
  for (var i = 0; i < oflCategories.length; i++) {
    var mapped = OFL_TO_DMXR_CATEGORY[oflCategories[i]];
    if (mapped) return mapped;
  }
  return "Other";
}
