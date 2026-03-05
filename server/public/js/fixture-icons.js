/**
 * Fixture type icons and category derivation mixin for DMXr.
 * Mixed into the main Alpine component via Object.assign.
 */

var FIXTURE_ICON_MAP = {
  "Color Changer": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="14" rx="2"/><circle cx="12" cy="11" r="3"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="9" y1="1" x2="7" y2="4"/><line x1="15" y1="1" x2="17" y2="4"/><line x1="12" y1="1" x2="12" y2="4"/></svg>',
  "Moving Head": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M9 20V14"/><path d="M15 20V14"/><rect x="7" y="6" width="10" height="8" rx="2"/><circle cx="12" cy="10" r="2"/><path d="M5 6c0-2 3-4 7-4s7 2 7 4" stroke-dasharray="2 2" opacity="0.5"/></svg>',
  "Scanner": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="10" height="8" rx="1"/><path d="M14 12l7-6"/><circle cx="14" cy="12" r="1.5"/><path d="M14 12l7 6" stroke-dasharray="2 2" opacity="0.4"/></svg>',
  "Dimmer": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V22"/><path d="M5.6 15.4l-2.8 2.8"/><path d="M18.4 15.4l2.8 2.8"/><path d="M2 12H4"/><path d="M20 12h2"/><path d="M12 2a8 8 0 010 16"/><path d="M12 2v16" stroke-dasharray="2 2" opacity="0.4"/></svg>',
  "Strobe": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-2 8 9-12h-7z"/></svg>',
  "Blinder": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="9" height="12" rx="2"/><rect x="13" y="6" width="9" height="12" rx="2"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="12" r="2.5"/></svg>',
  "Laser": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10l6 2-6 2"/><line x1="8" y1="12" x2="22" y2="12" stroke-width="2"/><circle cx="22" cy="12" r="1.5" fill="currentColor" stroke="none"/><line x1="18" y1="6" x2="20" y2="10" opacity="0.4"/><line x1="22" y1="5" x2="21" y2="9" opacity="0.4"/><line x1="18" y1="18" x2="20" y2="14" opacity="0.4"/></svg>',
  "Effect": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="5" x2="12" y2="1"/><line x1="12" y1="23" x2="12" y2="19"/><line x1="5" y1="12" x2="1" y2="12"/><line x1="23" y1="12" x2="19" y2="12"/><line x1="7.05" y1="7.05" x2="4.22" y2="4.22"/><line x1="19.78" y1="19.78" x2="16.95" y2="16.95"/></svg>',
  "Pixel Bar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="8" width="22" height="8" rx="2"/><circle cx="5" cy="12" r="1.5" fill="currentColor" opacity="0.6"/><circle cx="9.5" cy="12" r="1.5" fill="currentColor" opacity="0.6"/><circle cx="14.5" cy="12" r="1.5" fill="currentColor" opacity="0.6"/><circle cx="19" cy="12" r="1.5" fill="currentColor" opacity="0.6"/></svg>',
  "Blacklight": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="3"/><line x1="6" y1="6" x2="6" y2="9" stroke-dasharray="1 1.5" opacity="0.5"/><line x1="10" y1="5" x2="10" y2="9" stroke-dasharray="1 1.5" opacity="0.5"/><line x1="14" y1="5" x2="14" y2="9" stroke-dasharray="1 1.5" opacity="0.5"/><line x1="18" y1="6" x2="18" y2="9" stroke-dasharray="1 1.5" opacity="0.5"/></svg>',
  "Smoke Machine": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h8a3 3 0 1 0 3-3"/><path d="M3 12h12a3 3 0 1 1 3 3"/><path d="M3 16h6a3 3 0 1 0 3-3"/></svg>',
  "Other": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6"/><path d="M12 21v-2"/><path d="M12 3a6 6 0 016 6c0 2.2-1.2 3.8-2.5 5-.8.7-1.5 1.5-1.5 3h-4c0-1.5-.7-2.3-1.5-3C7.2 12.8 6 11.2 6 9a6 6 0 016-6z"/></svg>',
};

/**
 * Derive a fixture category from its channel list.
 * Mirrors the priority chain from classify-fixture.ts but works on OFL-style channel objects.
 * @param {Array<{type: string, color?: string}>} channels
 * @returns {string}
 */
function deriveFixtureCategory(channels, name) {
  if (!channels || channels.length === 0) return "Other";

  var hasPan = false;
  var hasTilt = false;
  var hasGobo = false;
  var hasPrism = false;
  var hasColorWheel = false;
  var hasStrobe = false;
  var hasColor = false;
  var hasUvOnly = true;
  var hasAnyColor = false;
  var hasIntensity = false;
  var allDimmer = true;

  var dimmerTypes = { Intensity: true, Generic: true, NoFunction: true };

  for (var i = 0; i < channels.length; i++) {
    var ch = channels[i];
    var t = ch.type;

    if (t === "Pan") hasPan = true;
    else if (t === "Tilt") hasTilt = true;
    else if (t === "Gobo") hasGobo = true;
    else if (t === "Prism") hasPrism = true;
    else if (t === "ColorWheel") hasColorWheel = true;
    else if (t === "Strobe" || t === "ShutterStrobe") hasStrobe = true;
    else if (t === "Intensity") hasIntensity = true;

    if (t === "ColorIntensity") {
      hasColor = true;
      hasAnyColor = true;
      if (ch.color !== "UV") hasUvOnly = false;
    }

    if (!dimmerTypes[t] && t !== "ColorIntensity") {
      allDimmer = false;
    }
  }

  if (hasPan && hasTilt) return "Moving Head";
  if (hasPan || hasTilt) return "Scanner";
  if (hasGobo || hasPrism || hasColorWheel) return "Effect";
  if (hasStrobe && !hasColor) return "Strobe";
  if (hasAnyColor && hasUvOnly) return "Blacklight";
  if (hasColor) return "Color Changer";
  if (allDimmer && hasIntensity && !hasColor) return "Dimmer";

  // Name heuristic as last resort
  if (name) {
    var n = name.toLowerCase();
    if (/\blaser\b/.test(n)) return "Laser";
    if (/\bsmoke\b|\bfog\b|\bhaze\b|\bhurricane\b/.test(n)) return "Smoke Machine";
    if (/\bblinder\b/.test(n)) return "Blinder";
    if (/\bstrobe\b/.test(n)) return "Strobe";
    if (/\bbar\b|\bstrip\b|\bpixel\b/.test(n)) return "Pixel Bar";
    if (/\bspot\b|\bpar\b/.test(n)) return "Color Changer";
  }

  return "Other";
}

/**
 * Get the SVG icon string for a category, falling back to "Other".
 * @param {string} category
 * @returns {string}
 */
function getFixtureIcon(category) {
  return FIXTURE_ICON_MAP[category] || FIXTURE_ICON_MAP["Other"];
}

/**
 * Get the icon for a fixture based on its channels or explicit categories.
 * For search results with categories[], use the first category.
 * For fixtures with channels[], derive from channel data.
 * @param {object} fixture - object with .channels and/or .categories
 * @returns {string} SVG string
 */
function getFixtureIconForResult(fixture) {
  // 1. Explicit category from config (persisted from source data)
  if (fixture.category && FIXTURE_ICON_MAP[fixture.category]) {
    return FIXTURE_ICON_MAP[fixture.category];
  }
  // 2. OFL search results have categories[]
  if (fixture.categories && fixture.categories.length > 0) {
    return getFixtureIcon(fixture.categories[0]);
  }
  // 3. Derive from channels + name heuristic
  if (fixture.channels) {
    return getFixtureIcon(deriveFixtureCategory(fixture.channels, fixture.name));
  }
  return getFixtureIcon("Other");
}

function dmxrFixtureIcons() {
  return {
    /**
     * Get SVG icon HTML for a fixture's derived category.
     * @param {object} fixture - fixture config with .channels
     * @returns {string}
     */
    fixtureIcon(fixture) {
      if (!fixture) return getFixtureIcon("Other");
      return getFixtureIconForResult(fixture);
    },

    /**
     * Get SVG icon for a category string directly.
     * @param {string} category
     * @returns {string}
     */
    categoryIcon(category) {
      return getFixtureIcon(category || "Other");
    },

    /**
     * Derive category from channels array.
     * @param {Array} channels
     * @returns {string}
     */
    deriveCategoryFromChannels(channels, name) {
      return deriveFixtureCategory(channels, name);
    },
  };
}
