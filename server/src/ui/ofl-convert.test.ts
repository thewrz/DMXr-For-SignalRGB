import { describe, it, expect } from 'vitest'
import {
  mapOflTypeToDmxr,
  mapDmxrTypeToOfl,
  mapOflCategoryToDmxr,
  mapDmxrCategoryToOfl,
  parseOflChannelToDmxr,
  buildDmxrChannelsFromOfl,
  buildOflExportJson,
} from './ofl-convert.js'

// ── mapOflTypeToDmxr ─────────────────────────────────────────────────

describe('mapOflTypeToDmxr', () => {
  it('maps ColorIntensity directly', () => {
    expect(mapOflTypeToDmxr('ColorIntensity')).toBe('ColorIntensity')
  })

  it('maps Intensity directly', () => {
    expect(mapOflTypeToDmxr('Intensity')).toBe('Intensity')
  })

  it('maps Pan directly', () => {
    expect(mapOflTypeToDmxr('Pan')).toBe('Pan')
  })

  it('maps Tilt directly', () => {
    expect(mapOflTypeToDmxr('Tilt')).toBe('Tilt')
  })

  it('maps Focus directly', () => {
    expect(mapOflTypeToDmxr('Focus')).toBe('Focus')
  })

  it('maps Zoom directly', () => {
    expect(mapOflTypeToDmxr('Zoom')).toBe('Zoom')
  })

  it('maps Iris directly', () => {
    expect(mapOflTypeToDmxr('Iris')).toBe('Iris')
  })

  it('maps Prism directly', () => {
    expect(mapOflTypeToDmxr('Prism')).toBe('Prism')
  })

  it('maps ShutterStrobe directly', () => {
    expect(mapOflTypeToDmxr('ShutterStrobe')).toBe('ShutterStrobe')
  })

  it('maps NoFunction directly', () => {
    expect(mapOflTypeToDmxr('NoFunction')).toBe('NoFunction')
  })

  it('maps Generic directly', () => {
    expect(mapOflTypeToDmxr('Generic')).toBe('Generic')
  })

  it('maps WheelSlot + "Gobo Wheel" → Gobo', () => {
    expect(mapOflTypeToDmxr('WheelSlot', 'Gobo Wheel')).toBe('Gobo')
  })

  it('maps WheelSlot + "Color Wheel" → ColorWheel', () => {
    expect(mapOflTypeToDmxr('WheelSlot', 'Color Wheel')).toBe('ColorWheel')
  })

  it('maps WheelSlot + unknown wheel → Generic', () => {
    expect(mapOflTypeToDmxr('WheelSlot', 'Prism Wheel')).toBe('Generic')
  })

  it('maps WheelSlot without wheel → Generic', () => {
    expect(mapOflTypeToDmxr('WheelSlot')).toBe('Generic')
  })

  it('maps unknown type → Generic', () => {
    expect(mapOflTypeToDmxr('SomeFutureType')).toBe('Generic')
  })
})

// ── mapDmxrTypeToOfl ─────────────────────────────────────────────────

describe('mapDmxrTypeToOfl', () => {
  it('maps ColorIntensity with color', () => {
    expect(mapDmxrTypeToOfl('ColorIntensity', 'Blue')).toEqual({
      type: 'ColorIntensity',
      color: 'Blue',
    })
  })

  it('maps ColorIntensity defaults to Red when no color given', () => {
    expect(mapDmxrTypeToOfl('ColorIntensity')).toEqual({
      type: 'ColorIntensity',
      color: 'Red',
    })
  })

  it('maps Strobe → ShutterStrobe', () => {
    expect(mapDmxrTypeToOfl('Strobe')).toEqual({
      type: 'ShutterStrobe',
      shutterEffect: 'Strobe',
    })
  })

  it('maps ShutterStrobe → ShutterStrobe', () => {
    expect(mapDmxrTypeToOfl('ShutterStrobe')).toEqual({
      type: 'ShutterStrobe',
      shutterEffect: 'Strobe',
    })
  })

  it('maps Gobo → WheelSlot with Gobo Wheel', () => {
    expect(mapDmxrTypeToOfl('Gobo')).toEqual({
      type: 'WheelSlot',
      wheel: 'Gobo Wheel',
    })
  })

  it('maps ColorWheel → WheelSlot with Color Wheel', () => {
    expect(mapDmxrTypeToOfl('ColorWheel')).toEqual({
      type: 'WheelSlot',
      wheel: 'Color Wheel',
    })
  })

  it('maps Intensity', () => {
    expect(mapDmxrTypeToOfl('Intensity')).toEqual({ type: 'Intensity' })
  })

  it('maps Pan', () => {
    expect(mapDmxrTypeToOfl('Pan')).toEqual({ type: 'Pan' })
  })

  it('maps Tilt', () => {
    expect(mapDmxrTypeToOfl('Tilt')).toEqual({ type: 'Tilt' })
  })

  it('maps unknown type → Generic', () => {
    expect(mapDmxrTypeToOfl('UnknownType')).toEqual({ type: 'Generic' })
  })
})

// ── mapOflCategoryToDmxr ─────────────────────────────────────────────

describe('mapOflCategoryToDmxr', () => {
  it('maps Color Changer', () => {
    expect(mapOflCategoryToDmxr(['Color Changer'])).toBe('Color Changer')
  })

  it('maps Moving Head', () => {
    expect(mapOflCategoryToDmxr(['Moving Head'])).toBe('Moving Head')
  })

  it('maps Scanner', () => {
    expect(mapOflCategoryToDmxr(['Scanner'])).toBe('Scanner')
  })

  it('maps Smoke → Smoke Machine', () => {
    expect(mapOflCategoryToDmxr(['Smoke'])).toBe('Smoke Machine')
  })

  it('maps Hazer → Smoke Machine', () => {
    expect(mapOflCategoryToDmxr(['Hazer'])).toBe('Smoke Machine')
  })

  it('maps Barrel Scanner → Scanner', () => {
    expect(mapOflCategoryToDmxr(['Barrel Scanner'])).toBe('Scanner')
  })

  it('maps Fan → Other', () => {
    expect(mapOflCategoryToDmxr(['Fan'])).toBe('Other')
  })

  it('maps empty array → Other', () => {
    expect(mapOflCategoryToDmxr([])).toBe('Other')
  })

  it('maps unknown category → Other', () => {
    expect(mapOflCategoryToDmxr(['Pyrotechnic'])).toBe('Other')
  })

  it('picks first matching category from array', () => {
    expect(mapOflCategoryToDmxr(['Fan', 'Moving Head'])).toBe('Other')
    expect(mapOflCategoryToDmxr(['Moving Head', 'Fan'])).toBe('Moving Head')
  })
})

// ── mapDmxrCategoryToOfl ─────────────────────────────────────────────

describe('mapDmxrCategoryToOfl', () => {
  it('maps Color Changer → ["Color Changer"]', () => {
    expect(mapDmxrCategoryToOfl('Color Changer')).toEqual(['Color Changer'])
  })

  it('maps Blacklight → ["Color Changer"]', () => {
    expect(mapDmxrCategoryToOfl('Blacklight')).toEqual(['Color Changer'])
  })

  it('maps Smoke Machine → ["Smoke"]', () => {
    expect(mapDmxrCategoryToOfl('Smoke Machine')).toEqual(['Smoke'])
  })

  it('maps unknown → ["Other"]', () => {
    expect(mapDmxrCategoryToOfl('SomethingNew')).toEqual(['Other'])
  })

  it('maps Moving Head → ["Moving Head"]', () => {
    expect(mapDmxrCategoryToOfl('Moving Head')).toEqual(['Moving Head'])
  })
})

// ── parseOflChannelToDmxr ────────────────────────────────────────────

describe('parseOflChannelToDmxr', () => {
  it('parses single capability ColorIntensity Red', () => {
    const result = parseOflChannelToDmxr(
      'Red',
      { capability: { type: 'ColorIntensity', color: 'Red' } },
      0,
    )
    expect(result).toEqual({
      offset: 0,
      name: 'Red',
      type: 'ColorIntensity',
      color: 'Red',
      defaultValue: 0,
    })
  })

  it('parses Intensity channel', () => {
    const result = parseOflChannelToDmxr(
      'Dimmer',
      { capability: { type: 'Intensity' } },
      3,
    )
    expect(result.type).toBe('Intensity')
    expect(result.color).toBe('')
    expect(result.offset).toBe(3)
  })

  it('parses multi-capability channel as Generic', () => {
    const result = parseOflChannelToDmxr(
      'Color Macro',
      {
        capabilities: [
          { type: 'ColorIntensity', color: 'Red' },
          { type: 'ColorIntensity', color: 'Blue' },
        ],
      },
      1,
    )
    expect(result.type).toBe('Generic')
    expect(result.color).toBe('')
  })

  it('parses single-element capabilities array', () => {
    const result = parseOflChannelToDmxr(
      'Focus',
      { capabilities: [{ type: 'Focus' }] },
      0,
    )
    expect(result.type).toBe('Focus')
  })

  it('scales defaultValue > 255 by dividing by 256', () => {
    const result = parseOflChannelToDmxr(
      'Dimmer',
      { capability: { type: 'Intensity' }, defaultValue: 32768 },
      0,
    )
    expect(result.defaultValue).toBe(128)
  })

  it('rounds defaultValue <= 255', () => {
    const result = parseOflChannelToDmxr(
      'Dimmer',
      { capability: { type: 'Intensity' }, defaultValue: 127.6 },
      0,
    )
    expect(result.defaultValue).toBe(128)
  })

  it('returns NoFunction for empty channel def', () => {
    const result = parseOflChannelToDmxr('Unknown', {}, 5)
    expect(result.type).toBe('NoFunction')
    expect(result.color).toBe('')
  })

  it('strips invalid color from ColorIntensity', () => {
    const result = parseOflChannelToDmxr(
      'Weird',
      { capability: { type: 'ColorIntensity', color: 'Chartreuse' } },
      0,
    )
    expect(result.type).toBe('ColorIntensity')
    expect(result.color).toBe('')
  })

  it('clears color for non-ColorIntensity types', () => {
    const result = parseOflChannelToDmxr(
      'Pan',
      { capability: { type: 'Pan', color: 'Red' } },
      0,
    )
    expect(result.type).toBe('Pan')
    expect(result.color).toBe('')
  })

  it('maps WheelSlot with Gobo Wheel → Gobo', () => {
    const result = parseOflChannelToDmxr(
      'Gobo',
      { capability: { type: 'WheelSlot', wheel: 'Gobo Wheel' } },
      0,
    )
    expect(result.type).toBe('Gobo')
  })

  it('maps WheelSlot with Color Wheel → ColorWheel', () => {
    const result = parseOflChannelToDmxr(
      'Color',
      { capability: { type: 'WheelSlot', wheel: 'Color Wheel' } },
      0,
    )
    expect(result.type).toBe('ColorWheel')
  })
})

// ── buildDmxrChannelsFromOfl ─────────────────────────────────────────

describe('buildDmxrChannelsFromOfl', () => {
  it('converts basic 3-channel RGB mode', () => {
    const available = {
      Red: { capability: { type: 'ColorIntensity', color: 'Red' } },
      Green: { capability: { type: 'ColorIntensity', color: 'Green' } },
      Blue: { capability: { type: 'ColorIntensity', color: 'Blue' } },
    }
    const result = buildDmxrChannelsFromOfl(available, ['Red', 'Green', 'Blue'])
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      offset: 0,
      name: 'Red',
      type: 'ColorIntensity',
      color: 'Red',
      defaultValue: 0,
    })
    expect(result[1].offset).toBe(1)
    expect(result[2].offset).toBe(2)
  })

  it('skips null entries and keeps offsets dense', () => {
    const available = {
      Red: { capability: { type: 'ColorIntensity', color: 'Red' } },
      Blue: { capability: { type: 'ColorIntensity', color: 'Blue' } },
    }
    const result = buildDmxrChannelsFromOfl(available, ['Red', null, 'Blue'])
    expect(result).toHaveLength(2)
    expect(result[0].offset).toBe(0)
    expect(result[1].offset).toBe(1)
    expect(result[1].name).toBe('Blue')
  })

  it('returns empty array for empty mode', () => {
    expect(buildDmxrChannelsFromOfl({}, [])).toEqual([])
  })

  it('falls back to NoFunction for missing channel in availableChannels', () => {
    const result = buildDmxrChannelsFromOfl({}, ['MissingChannel'])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('NoFunction')
  })

  it('handles mode with all null entries', () => {
    const result = buildDmxrChannelsFromOfl({}, [null, null])
    expect(result).toEqual([])
  })

  it('preserves defaultValue from channel def', () => {
    const available = {
      Dimmer: { capability: { type: 'Intensity' }, defaultValue: 255 },
    }
    const result = buildDmxrChannelsFromOfl(available, ['Dimmer'])
    expect(result[0].defaultValue).toBe(255)
  })
})

// ── buildOflExportJson ───────────────────────────────────────────────

describe('buildOflExportJson', () => {
  const date = '2026-01-15'

  it('builds correct structure for single-mode fixture', () => {
    const modes = [
      {
        name: '3-channel',
        channels: [
          { offset: 0, name: 'Red', type: 'ColorIntensity', color: 'Red', defaultValue: 0 },
          { offset: 1, name: 'Green', type: 'ColorIntensity', color: 'Green', defaultValue: 0 },
          { offset: 2, name: 'Blue', type: 'ColorIntensity', color: 'Blue', defaultValue: 0 },
        ],
      },
    ]
    const result = buildOflExportJson('Test PAR', ['Color Changer'], modes, date)

    expect(result.$schema).toContain('fixture.json')
    expect(result.name).toBe('Test PAR')
    expect(result.categories).toEqual(['Color Changer'])
    expect(result.meta.authors).toEqual(['DMXr Export'])
    expect(result.meta.createDate).toBe(date)
    expect(result.modes).toHaveLength(1)
    expect(result.modes[0].name).toBe('3-channel')
    expect(result.modes[0].channels).toEqual(['Red', 'Green', 'Blue'])
    expect(result.availableChannels.Red.capability).toEqual({
      type: 'ColorIntensity',
      color: 'Red',
    })
  })

  it('reuses shared channel name across modes with same capability', () => {
    const modes = [
      {
        name: '3-channel',
        channels: [
          { offset: 0, name: 'Red', type: 'ColorIntensity', color: 'Red', defaultValue: 0 },
          { offset: 1, name: 'Green', type: 'ColorIntensity', color: 'Green', defaultValue: 0 },
          { offset: 2, name: 'Blue', type: 'ColorIntensity', color: 'Blue', defaultValue: 0 },
        ],
      },
      {
        name: '4-channel',
        channels: [
          { offset: 0, name: 'Red', type: 'ColorIntensity', color: 'Red', defaultValue: 0 },
          { offset: 1, name: 'Green', type: 'ColorIntensity', color: 'Green', defaultValue: 0 },
          { offset: 2, name: 'Blue', type: 'ColorIntensity', color: 'Blue', defaultValue: 0 },
          { offset: 3, name: 'Dimmer', type: 'Intensity', color: '', defaultValue: 0 },
        ],
      },
    ]
    const result = buildOflExportJson('RGB PAR', ['Color Changer'], modes, date)

    // Shared channels should NOT get suffixed
    expect(result.modes[0].channels).toEqual(['Red', 'Green', 'Blue'])
    expect(result.modes[1].channels).toEqual(['Red', 'Green', 'Blue', 'Dimmer'])
    expect(Object.keys(result.availableChannels)).toEqual([
      'Red',
      'Green',
      'Blue',
      'Dimmer',
    ])
  })

  it('creates suffixed names for different capabilities with same name', () => {
    const modes = [
      {
        name: 'mode1',
        channels: [
          { offset: 0, name: 'Control', type: 'Intensity', color: '', defaultValue: 0 },
        ],
      },
      {
        name: 'mode2',
        channels: [
          { offset: 0, name: 'Control', type: 'Strobe', color: '', defaultValue: 0 },
        ],
      },
    ]
    const result = buildOflExportJson('Test', ['Other'], modes, date)

    expect(result.modes[0].channels).toEqual(['Control'])
    expect(result.modes[1].channels).toEqual(['Control 2'])
    expect(result.availableChannels['Control'].capability).toEqual({
      type: 'Intensity',
    })
    expect(result.availableChannels['Control 2'].capability).toEqual({
      type: 'ShutterStrobe',
      shutterEffect: 'Strobe',
    })
  })

  it('includes defaultValue when non-zero', () => {
    const modes = [
      {
        name: 'mode',
        channels: [
          { offset: 0, name: 'Dimmer', type: 'Intensity', color: '', defaultValue: 255 },
        ],
      },
    ]
    const result = buildOflExportJson('Test', ['Other'], modes, date)
    expect(result.availableChannels.Dimmer.defaultValue).toBe(255)
  })

  it('omits defaultValue when zero', () => {
    const modes = [
      {
        name: 'mode',
        channels: [
          { offset: 0, name: 'Dimmer', type: 'Intensity', color: '', defaultValue: 0 },
        ],
      },
    ]
    const result = buildOflExportJson('Test', ['Other'], modes, date)
    expect(result.availableChannels.Dimmer.defaultValue).toBeUndefined()
  })

  it('auto-generates mode name from channel count', () => {
    const modes = [
      {
        name: '',
        channels: [
          { offset: 0, name: 'Dimmer', type: 'Intensity', color: '', defaultValue: 0 },
        ],
      },
    ]
    const result = buildOflExportJson('Test', ['Other'], modes, date)
    expect(result.modes[0].name).toBe('1-channel')
  })

  it('auto-generates channel name when empty', () => {
    const modes = [
      {
        name: 'mode',
        channels: [
          { offset: 0, name: '', type: 'Generic', color: '', defaultValue: 0 },
        ],
      },
    ]
    const result = buildOflExportJson('Test', ['Other'], modes, date)
    expect(result.modes[0].channels).toEqual(['Channel 1'])
  })

  it('handles multiple channels with same name and same capability within a mode', () => {
    const modes = [
      {
        name: 'mode',
        channels: [
          { offset: 0, name: 'Red', type: 'ColorIntensity', color: 'Red', defaultValue: 0 },
          { offset: 1, name: 'Red', type: 'ColorIntensity', color: 'Red', defaultValue: 0 },
        ],
      },
    ]
    const result = buildOflExportJson('Test', ['Other'], modes, date)
    // Second "Red" has same capability, so it reuses the same key
    expect(result.modes[0].channels).toEqual(['Red', 'Red'])
  })
})

// ── Round-trip tests ─────────────────────────────────────────────────

describe('round-trip', () => {
  const date = '2026-01-15'

  it('export DMXr → import OFL → channels match original', () => {
    const originalChannels = [
      { offset: 0, name: 'Red', type: 'ColorIntensity', color: 'Red', defaultValue: 0 },
      { offset: 1, name: 'Green', type: 'ColorIntensity', color: 'Green', defaultValue: 0 },
      { offset: 2, name: 'Blue', type: 'ColorIntensity', color: 'Blue', defaultValue: 0 },
      { offset: 3, name: 'Dimmer', type: 'Intensity', color: '', defaultValue: 255 },
    ]
    const modes = [{ name: '4-channel', channels: originalChannels }]

    const ofl = buildOflExportJson('PAR', ['Color Changer'], modes, date)
    const imported = buildDmxrChannelsFromOfl(
      ofl.availableChannels,
      ofl.modes[0].channels,
    )

    expect(imported).toEqual(originalChannels)
  })

  it('Gobo/ColorWheel survive round-trip via WheelSlot discrimination', () => {
    const originalChannels = [
      { offset: 0, name: 'Gobo', type: 'Gobo', color: '', defaultValue: 0 },
      { offset: 1, name: 'Color', type: 'ColorWheel', color: '', defaultValue: 0 },
    ]
    const modes = [{ name: 'mode', channels: originalChannels }]

    const ofl = buildOflExportJson('Test', ['Other'], modes, date)

    // Verify OFL structure uses WheelSlot with discriminating wheel name
    expect(ofl.availableChannels.Gobo.capability).toEqual({
      type: 'WheelSlot',
      wheel: 'Gobo Wheel',
    })
    expect(ofl.availableChannels.Color.capability).toEqual({
      type: 'WheelSlot',
      wheel: 'Color Wheel',
    })

    const imported = buildDmxrChannelsFromOfl(
      ofl.availableChannels,
      ofl.modes[0].channels,
    )
    expect(imported).toEqual(originalChannels)
  })

  it('multi-capability channels → Generic (lossy but expected)', () => {
    const multiCapChannel = {
      capabilities: [
        { type: 'ColorIntensity', color: 'Red' },
        { type: 'ColorIntensity', color: 'Blue' },
      ],
    }
    const parsed = parseOflChannelToDmxr('Color Macro', multiCapChannel, 0)
    expect(parsed.type).toBe('Generic')

    // Re-export as Generic, which is a different shape than the original
    const ofl = buildOflExportJson(
      'Test',
      ['Other'],
      [{ name: 'mode', channels: [parsed] }],
      date,
    )
    expect(ofl.availableChannels['Color Macro'].capability).toEqual({
      type: 'Generic',
    })
  })
})
