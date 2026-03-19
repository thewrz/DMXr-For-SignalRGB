/**
 * Fixture CRUD and control operations for DMXr.
 *
 * Split into sub-modules for maintainability:
 *   fixture-crud.js     — loading, polling, CRUD, validation, duplication
 *   fixture-controls.js — flash, control modes, component sync, overrides
 *
 * Mixed into the main Alpine component via Object.assign.
 */
function dmxrFixtureManager() {
  var result = {};
  Object.defineProperties(result, Object.getOwnPropertyDescriptors(dmxrFixtureCrud()));
  Object.defineProperties(result, Object.getOwnPropertyDescriptors(dmxrFixtureControls()));
  return result;
}
