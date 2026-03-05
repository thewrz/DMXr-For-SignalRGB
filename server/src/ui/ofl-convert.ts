/**
 * Pure OFL ↔ DMXr conversion logic.
 * TypeScript equivalent of the browser-side ofl-export.js functions.
 */

const OFL_SCHEMA_URL =
  'https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/schemas/fixture.json'

// ── Type mappings ────────────────────────────────────────────────────

const OFL_TO_DMXR_TYPE: Record<string, string> = {
  ColorIntensity: 'ColorIntensity',
  Intensity: 'Intensity',
  Pan: 'Pan',
  Tilt: 'Tilt',
  Focus: 'Focus',
  Zoom: 'Zoom',
  Gobo: 'Gobo',
  WheelSlot: 'Generic',
  Iris: 'Iris',
  Prism: 'Prism',
  ColorWheel: 'ColorWheel',
  ShutterStrobe: 'ShutterStrobe',
  NoFunction: 'NoFunction',
  Generic: 'Generic',
}

const DMXR_TO_OFL_CAPABILITY: Record<
  string,
  (ch: { color?: string }) => OflCapability
> = {
  ColorIntensity: (ch) => ({
    type: 'ColorIntensity',
    color: ch.color || 'Red',
  }),
  Intensity: () => ({ type: 'Intensity' }),
  Pan: () => ({ type: 'Pan' }),
  Tilt: () => ({ type: 'Tilt' }),
  ShutterStrobe: () => ({ type: 'ShutterStrobe', shutterEffect: 'Strobe' }),
  Strobe: () => ({ type: 'ShutterStrobe', shutterEffect: 'Strobe' }),
  Gobo: () => ({ type: 'WheelSlot', wheel: 'Gobo Wheel' }),
  ColorWheel: () => ({ type: 'WheelSlot', wheel: 'Color Wheel' }),
  Focus: () => ({ type: 'Focus' }),
  Zoom: () => ({ type: 'Zoom' }),
  Iris: () => ({ type: 'Iris' }),
  Prism: () => ({ type: 'Prism' }),
  NoFunction: () => ({ type: 'NoFunction' }),
  Generic: () => ({ type: 'Generic' }),
}

// ── Category mappings ────────────────────────────────────────────────

const OFL_TO_DMXR_CATEGORY: Record<string, string> = {
  'Color Changer': 'Color Changer',
  'Moving Head': 'Moving Head',
  Scanner: 'Scanner',
  Laser: 'Laser',
  Dimmer: 'Dimmer',
  Strobe: 'Strobe',
  Blinder: 'Blinder',
  Effect: 'Effect',
  'Pixel Bar': 'Pixel Bar',
  Smoke: 'Smoke Machine',
  Hazer: 'Smoke Machine',
  'Barrel Scanner': 'Scanner',
  Fan: 'Other',
  Matrix: 'Other',
  Stand: 'Other',
  Flower: 'Other',
  Other: 'Other',
}

const DMXR_TO_OFL_CATEGORIES: Record<string, string[]> = {
  'Color Changer': ['Color Changer'],
  'Moving Head': ['Moving Head'],
  Scanner: ['Scanner'],
  Laser: ['Laser'],
  Dimmer: ['Dimmer'],
  Strobe: ['Strobe'],
  Blinder: ['Blinder'],
  Effect: ['Effect'],
  'Pixel Bar': ['Pixel Bar'],
  Blacklight: ['Color Changer'],
  'Smoke Machine': ['Smoke'],
  Other: ['Other'],
}

// ── Interfaces ───────────────────────────────────────────────────────

export interface OflCapability {
  type: string
  color?: string
  shutterEffect?: string
  wheel?: string
}

export interface OflChannelDef {
  capability?: OflCapability
  capabilities?: OflCapability[]
  defaultValue?: number
}

export interface DmxrChannel {
  offset: number
  name: string
  type: string
  color: string
  defaultValue: number
}

export interface DmxrMode {
  name: string
  channels: DmxrChannel[]
}

export interface OflExportJson {
  $schema: string
  name: string
  categories: string[]
  meta: {
    authors: string[]
    createDate: string
    lastModifyDate: string
  }
  availableChannels: Record<string, OflChannelDef>
  modes: Array<{ name: string; channels: string[] }>
}

// ── Valid colors ─────────────────────────────────────────────────────

const VALID_COLORS = new Set([
  'Red',
  'Green',
  'Blue',
  'White',
  'Amber',
  'UV',
  'Cyan',
  'Magenta',
  'Yellow',
])

// ── Public functions ─────────────────────────────────────────────────

export function mapOflTypeToDmxr(
  oflType: string,
  wheel?: string,
): string {
  if (oflType === 'WheelSlot' && wheel) {
    if (wheel === 'Gobo Wheel') return 'Gobo'
    if (wheel === 'Color Wheel') return 'ColorWheel'
    return 'Generic'
  }
  return OFL_TO_DMXR_TYPE[oflType] || 'Generic'
}

export function mapDmxrTypeToOfl(
  dmxrType: string,
  color?: string,
): OflCapability {
  const fn = DMXR_TO_OFL_CAPABILITY[dmxrType]
  if (fn) return fn({ color })
  return { type: 'Generic' }
}

export function mapOflCategoryToDmxr(oflCategories: string[]): string {
  if (!oflCategories || oflCategories.length === 0) return 'Other'
  for (const cat of oflCategories) {
    const mapped = OFL_TO_DMXR_CATEGORY[cat]
    if (mapped) return mapped
  }
  return 'Other'
}

export function mapDmxrCategoryToOfl(dmxrCategory: string): string[] {
  return DMXR_TO_OFL_CATEGORIES[dmxrCategory] || ['Other']
}

export function parseOflChannelToDmxr(
  name: string,
  chDef: OflChannelDef,
  offset: number,
): DmxrChannel {
  let type = 'NoFunction'
  let color = ''
  let defaultValue = 0

  if (typeof chDef.defaultValue === 'number') {
    defaultValue =
      chDef.defaultValue > 255
        ? Math.floor(chDef.defaultValue / 256)
        : Math.round(chDef.defaultValue)
  }

  if (chDef.capability && chDef.capability.type) {
    const oflType = chDef.capability.type
    if (oflType === 'WheelSlot' && chDef.capability.wheel) {
      type = mapOflTypeToDmxr(oflType, chDef.capability.wheel)
    } else {
      type = OFL_TO_DMXR_TYPE[oflType] || 'Generic'
    }
    color = chDef.capability.color || ''
  } else if (chDef.capabilities && chDef.capabilities.length > 0) {
    for (const cap of chDef.capabilities) {
      if (cap.type) {
        type = OFL_TO_DMXR_TYPE[cap.type] || 'Generic'
        color = cap.color || ''
        break
      }
    }
    if (chDef.capabilities.length > 1) {
      type = 'Generic'
      color = ''
    }
  }

  if (type !== 'ColorIntensity') {
    color = ''
  } else if (color && !VALID_COLORS.has(color)) {
    color = ''
  }

  return { offset, name, type, color, defaultValue }
}

export function buildDmxrChannelsFromOfl(
  availableChannels: Record<string, OflChannelDef>,
  modeChannels: (string | null)[],
): DmxrChannel[] {
  const channels: DmxrChannel[] = []
  let offset = 0

  for (const chName of modeChannels) {
    if (chName === null) continue
    const chDef = availableChannels[chName] || {}
    channels.push(parseOflChannelToDmxr(chName, chDef, offset))
    offset++
  }

  return channels
}

function capabilitiesEqual(a: OflCapability, b: OflCapability): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function buildOflExportJson(
  name: string,
  categories: string[],
  modes: DmxrMode[],
  dateOverride?: string,
): OflExportJson {
  const today = dateOverride || new Date().toISOString().split('T')[0]

  const allChannels: Record<string, OflChannelDef> = {}
  const modesDef: Array<{ name: string; channels: string[] }> = []
  const nameCounts: Record<string, number> = {}

  for (const mode of modes) {
    const modeChannelNames: string[] = []

    for (let i = 0; i < mode.channels.length; i++) {
      const ch = mode.channels[i]
      const baseName = ch.name || `Channel ${i + 1}`

      const capFn = DMXR_TO_OFL_CAPABILITY[ch.type]
      const capability = capFn ? capFn(ch) : { type: 'Generic' }
      const chDef: OflChannelDef = { capability }
      if (typeof ch.defaultValue === 'number' && ch.defaultValue !== 0) {
        chDef.defaultValue = ch.defaultValue
      }

      let uniqueName = baseName
      if (allChannels[baseName] !== undefined) {
        if (capabilitiesEqual(allChannels[baseName].capability!, capability)) {
          uniqueName = baseName
        } else {
          if (nameCounts[baseName] === undefined) {
            nameCounts[baseName] = 1
          }
          nameCounts[baseName]++
          uniqueName = `${baseName} ${nameCounts[baseName]}`
        }
      }

      if (!allChannels[uniqueName]) {
        allChannels[uniqueName] = chDef
      }
      modeChannelNames.push(uniqueName)
    }

    modesDef.push({
      name: mode.name || `${mode.channels.length}-channel`,
      channels: modeChannelNames,
    })
  }

  return {
    $schema: OFL_SCHEMA_URL,
    name,
    categories,
    meta: {
      authors: ['DMXr Export'],
      createDate: today,
      lastModifyDate: today,
    },
    availableChannels: allChannels,
    modes: modesDef,
  }
}
