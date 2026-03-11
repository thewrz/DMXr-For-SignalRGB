export const addFixtureSchema = {
  body: {
    type: "object" as const,
    required: [
      "name",
      "mode",
      "dmxStartAddress",
      "channelCount",
      "channels",
    ],
    properties: {
      name: { type: "string" as const, minLength: 1 },
      universeId: { type: "string" as const },
      oflKey: { type: "string" as const },
      oflFixtureName: { type: "string" as const },
      source: { type: "string" as const, enum: ["ofl", "local-db", "custom"] },
      category: { type: "string" as const },
      mode: { type: "string" as const, minLength: 1 },
      dmxStartAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
      channelCount: { type: "integer" as const, minimum: 1 },
      channels: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["offset", "name", "type", "defaultValue"],
          properties: {
            offset: { type: "integer" as const, minimum: 0 },
            name: { type: "string" as const },
            type: { type: "string" as const },
            color: { type: "string" as const },
            defaultValue: { type: "integer" as const, minimum: 0, maximum: 255 },
          },
        },
      },
      channelRemap: {
        type: "object" as const,
        additionalProperties: { type: "integer" as const, minimum: 0 },
      },
    },
  },
};

export const updateFixtureSchema = {
  body: {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, minLength: 1 },
      universeId: { type: "string" as const },
      version: { type: "integer" as const, minimum: 1 },
      dmxStartAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
      channelOverrides: {
        type: "object" as const,
        additionalProperties: {
          type: "object" as const,
          required: ["value", "enabled"],
          properties: {
            value: { type: "integer" as const, minimum: 0, maximum: 255 },
            enabled: { type: "boolean" as const },
          },
          additionalProperties: false,
        },
      },
      channelRemap: {
        type: "object" as const,
        additionalProperties: { type: "integer" as const, minimum: 0 },
      },
      whiteGateThreshold: { type: "integer" as const, minimum: 0, maximum: 255 },
      motorGuardEnabled: { type: "boolean" as const },
      motorGuardBuffer: { type: "integer" as const, minimum: 0, maximum: 20 },
      resetConfig: {
        type: "object" as const,
        required: ["channelOffset", "value", "holdMs"],
        properties: {
          channelOffset: { type: "integer" as const, minimum: 0 },
          value: { type: "integer" as const, minimum: 0, maximum: 255 },
          holdMs: { type: "integer" as const, minimum: 1000, maximum: 15000 },
        },
        additionalProperties: false,
      },
      colorCalibration: {
        type: "object" as const,
        required: ["gain", "offset"],
        properties: {
          gain: {
            type: "object" as const,
            required: ["r", "g", "b"],
            properties: {
              r: { type: "number" as const, minimum: 0, maximum: 2 },
              g: { type: "number" as const, minimum: 0, maximum: 2 },
              b: { type: "number" as const, minimum: 0, maximum: 2 },
            },
            additionalProperties: false,
          },
          offset: {
            type: "object" as const,
            required: ["r", "g", "b"],
            properties: {
              r: { type: "number" as const, minimum: -50, maximum: 50 },
              g: { type: "number" as const, minimum: -50, maximum: 50 },
              b: { type: "number" as const, minimum: -50, maximum: 50 },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
  },
};

export const duplicateFixtureSchema = {
  body: {
    type: "object" as const,
    properties: {
      dmxStartAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
      name: { type: "string" as const, minLength: 1 },
      universeId: { type: "string" as const },
    },
  },
};
