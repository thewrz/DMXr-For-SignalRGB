const NOISE_WORDS = new Set([
  'led', 'stage', 'light', 'moving', 'head',
  'fixture', 'par', 'wash', 'beam', 'spot',
])

export function abbreviateFixtureName(name: string): string {
  if (!name) return ''

  const words = name
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)

  const meaningful = words.filter(w => !NOISE_WORDS.has(w.toLowerCase()))

  if (meaningful.length === 0) {
    return name.replace(/[-_\s]/g, '').slice(0, 3).toUpperCase()
  }

  if (meaningful.length === 1) {
    return meaningful[0].slice(0, 3).toUpperCase()
  }

  return meaningful
    .slice(0, 3)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

interface FixtureInfo {
  fixture: { name: string; channelCount: number }
  offset: number
}

export function getChannelLabelData(
  address: number,
  info: FixtureInfo | null,
): number | string {
  if (!info) return address
  if (info.offset === 0) return address
  if (info.offset === 1 && info.fixture.channelCount >= 2) {
    return abbreviateFixtureName(info.fixture.name)
  }
  return address
}
