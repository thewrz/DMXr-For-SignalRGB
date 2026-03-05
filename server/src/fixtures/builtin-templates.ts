import type { FixtureChannel } from "../types/protocol.js";
import type { UserFixtureTemplate, UserFixtureMode } from "./user-fixture-types.js";

/** Stable timestamp for all builtin templates (avoids regeneration drift). */
const BUILTIN_EPOCH = "2026-03-05T00:00:00.000Z";

function rgb(offset: number, name: string, color: string): FixtureChannel {
  return { offset, name, type: "ColorIntensity", color, defaultValue: 0 };
}

function intensity(offset: number, name: string): FixtureChannel {
  return { offset, name, type: "Intensity", defaultValue: 0 };
}

function strobe(offset: number): FixtureChannel {
  return { offset, name: "Strobe", type: "Strobe", defaultValue: 0 };
}

function generic(offset: number, name: string): FixtureChannel {
  return { offset, name, type: "Generic", defaultValue: 0 };
}

function buildTemplate(
  id: string,
  name: string,
  category: string,
  modes: readonly { readonly name: string; readonly channels: readonly FixtureChannel[] }[],
): UserFixtureTemplate {
  return {
    id,
    name,
    manufacturer: "Generic",
    category,
    modes: modes.map((m): UserFixtureMode => ({
      id: `${id}--${m.name}`,
      name: m.name,
      channels: m.channels,
    })),
    createdAt: BUILTIN_EPOCH,
    updatedAt: BUILTIN_EPOCH,
  };
}

const BUILTIN_TEMPLATES: readonly UserFixtureTemplate[] = [
  buildTemplate("builtin-rgb-3ch", "RGB PAR (3ch)", "Color Changer", [
    {
      name: "3-channel",
      channels: [
        rgb(0, "Red", "Red"),
        rgb(1, "Green", "Green"),
        rgb(2, "Blue", "Blue"),
      ],
    },
  ]),

  buildTemplate("builtin-rgbw-4ch", "RGBW PAR (4ch)", "Color Changer", [
    {
      name: "4-channel",
      channels: [
        rgb(0, "Red", "Red"),
        rgb(1, "Green", "Green"),
        rgb(2, "Blue", "Blue"),
        rgb(3, "White", "White"),
      ],
    },
  ]),

  buildTemplate("builtin-dim-rgb-4ch", "Dimmer + RGB PAR (4ch)", "Color Changer", [
    {
      name: "4-channel",
      channels: [
        intensity(0, "Dimmer"),
        rgb(1, "Red", "Red"),
        rgb(2, "Green", "Green"),
        rgb(3, "Blue", "Blue"),
      ],
    },
  ]),

  buildTemplate("builtin-dim-rgb-strobe-5ch", "Dimmer + RGB + Strobe (5ch)", "Color Changer", [
    {
      name: "5-channel",
      channels: [
        intensity(0, "Dimmer"),
        rgb(1, "Red", "Red"),
        rgb(2, "Green", "Green"),
        rgb(3, "Blue", "Blue"),
        strobe(4),
      ],
    },
  ]),

  buildTemplate("builtin-dim-rgbw-strobe-6ch", "Dimmer + RGBW + Strobe (6ch)", "Color Changer", [
    {
      name: "6-channel",
      channels: [
        intensity(0, "Dimmer"),
        rgb(1, "Red", "Red"),
        rgb(2, "Green", "Green"),
        rgb(3, "Blue", "Blue"),
        rgb(4, "White", "White"),
        strobe(5),
      ],
    },
  ]),

  buildTemplate(
    "builtin-rgb-dim-strobe-mode-speed-7ch",
    "RGB + Dimmer + Strobe + Mode + Speed (7ch)",
    "Color Changer",
    [
      {
        name: "7-channel",
        channels: [
          intensity(0, "Dimmer"),
          rgb(1, "Red", "Red"),
          rgb(2, "Green", "Green"),
          rgb(3, "Blue", "Blue"),
          strobe(4),
          generic(5, "Mode"),
          generic(6, "Speed"),
        ],
      },
    ],
  ),

  buildTemplate(
    "builtin-rgbw-dim-strobe-mode-speed-8ch",
    "RGBW + Dimmer + Strobe + Mode + Speed (8ch)",
    "Color Changer",
    [
      {
        name: "8-channel",
        channels: [
          intensity(0, "Dimmer"),
          rgb(1, "Red", "Red"),
          rgb(2, "Green", "Green"),
          rgb(3, "Blue", "Blue"),
          rgb(4, "White", "White"),
          strobe(5),
          generic(6, "Mode"),
          generic(7, "Speed"),
        ],
      },
    ],
  ),

  buildTemplate("builtin-dimmer-1ch", "Single Channel Dimmer (1ch)", "Dimmer", [
    {
      name: "1-channel",
      channels: [intensity(0, "Dimmer")],
    },
  ]),

  buildTemplate("builtin-uv-blacklight-7ch", "UV Blacklight (7ch)", "Color Changer", [
    {
      name: "7-channel",
      channels: [
        intensity(0, "Dimmer"),
        rgb(1, "Red", "Red"),
        rgb(2, "Green", "Green"),
        rgb(3, "Blue", "Blue"),
        strobe(4),
        generic(5, "Mode"),
        generic(6, "Speed"),
      ],
    },
    {
      name: "1-channel UV",
      channels: [rgb(0, "UV", "UV")],
    },
  ]),
];

const TEMPLATE_MAP = new Map(BUILTIN_TEMPLATES.map((t) => [t.id, t]));

export function getBuiltinTemplates(): readonly UserFixtureTemplate[] {
  return BUILTIN_TEMPLATES;
}

export function getBuiltinTemplateById(id: string): UserFixtureTemplate | undefined {
  return TEMPLATE_MAP.get(id);
}
