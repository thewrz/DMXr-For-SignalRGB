/**
 * Channel label logic for DMXr grid.
 * Browser-compatible IIFE — exposes abbreviateFixtureName globally.
 */
(function() {
  var NOISE_WORDS = [
    'led', 'stage', 'light', 'moving', 'head',
    'fixture', 'par', 'wash', 'beam', 'spot',
  ];

  function isNoise(word) {
    return NOISE_WORDS.indexOf(word.toLowerCase()) !== -1;
  }

  window.abbreviateFixtureName = function(name) {
    if (!name) return '';

    var words = name
      .replace(/[-_]/g, ' ')
      .split(/\s+/)
      .filter(function(w) { return w.length > 0; });

    var meaningful = words.filter(function(w) { return !isNoise(w); });

    if (meaningful.length === 0) {
      return name.replace(/[-_\s]/g, '').slice(0, 3).toUpperCase();
    }

    if (meaningful.length === 1) {
      return meaningful[0].slice(0, 3).toUpperCase();
    }

    return meaningful
      .slice(0, 3)
      .map(function(w) { return w[0]; })
      .join('')
      .toUpperCase();
  };
})();
