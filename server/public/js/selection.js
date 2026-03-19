/**
 * Multi-select fixture management for DMXr.
 * Provides Ctrl+click / Shift+click selection on fixture cards and grid cells,
 * marquee drag-select on the DMX grid, and a floating action bar for batch
 * delete, duplicate, and group operations.
 *
 * Split into sub-modules for maintainability:
 *   selection-core.js    — state, selection logic, marquee, keyboard shortcuts
 *   selection-actions.js — batch delete, duplicate, group, move operations
 *
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrSelection() {
  var result = {};
  // Use defineProperties to preserve getters (hasSelection, selectionCount, etc.)
  Object.defineProperties(result, Object.getOwnPropertyDescriptors(dmxrSelectionCore()));
  Object.defineProperties(result, Object.getOwnPropertyDescriptors(dmxrSelectionActions()));
  return result;
}
