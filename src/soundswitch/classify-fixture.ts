const PAN = 3;
const TILT = 4;

const COLOR_TYPES = new Set([2, 11, 12, 13, 14, 15, 16, 87, 105, 106]);
const STROBE_TYPES = new Set([41, 64]);
const EFFECT_TYPES = new Set([7, 8, 9]);
const GENERIC_TYPES = new Set([17, 20, 21, 82, 83, 84, 85, 88]);
const DIMMER_TYPES = new Set([1, ...GENERIC_TYPES]);

/**
 * Classify a SoundSwitch fixture by its attr type codes.
 *
 * Priority chain: Moving Head > Scanner > Effect > Strobe > Color Changer > Dimmer > Other
 */
export function classifyFixture(attrTypes: readonly number[]): string {
  if (attrTypes.length === 0) return "Other";

  const types = new Set(attrTypes);
  const hasPan = types.has(PAN);
  const hasTilt = types.has(TILT);
  const hasColor = [...types].some((t) => COLOR_TYPES.has(t));
  const hasStrobe = [...types].some((t) => STROBE_TYPES.has(t));
  const hasEffect = [...types].some((t) => EFFECT_TYPES.has(t));

  // Moving Head: Pan AND Tilt
  if (hasPan && hasTilt) return "Moving Head";

  // Scanner: Pan XOR Tilt
  if (hasPan || hasTilt) return "Scanner";

  // Effect: Gobo or Prism, no Pan/Tilt
  if (hasEffect) return "Effect";

  // Strobe: strobe channel but no color and no Pan/Tilt
  if (hasStrobe && !hasColor) return "Strobe";

  // Color Changer: any color channel, no Pan/Tilt
  if (hasColor) return "Color Changer";

  // Dimmer: only intensity and/or generic
  const allDimmer = [...types].every((t) => DIMMER_TYPES.has(t));
  if (allDimmer) return "Dimmer";

  return "Other";
}
