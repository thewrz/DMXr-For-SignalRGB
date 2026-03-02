import { describe, it, expect } from 'vitest'
import { abbreviateFixtureName, getChannelLabelData } from './channel-label.js'

describe('abbreviateFixtureName', () => {
  it('returns max 3 characters', () => {
    const result = abbreviateFixtureName('Some Very Long Fixture Name')
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('strips noise words and uses initials of remaining words', () => {
    // "SLM70S Moving Head" → remove "Moving", "Head" → "SLM70S" → first 3 chars
    expect(abbreviateFixtureName('SLM70S Moving Head')).toBe('SLM')
  })

  it('uses first letter of each remaining word for multi-word names', () => {
    // "Mega Tri Par" → remove "Par" → "Mega", "Tri" → "MT"
    expect(abbreviateFixtureName('Mega Tri Par')).toBe('MT')
  })

  it('truncates single remaining word to 3 chars', () => {
    // "Sharpy" → no noise words → single word → "SHA"
    expect(abbreviateFixtureName('Sharpy')).toBe('SHA')
  })

  it('handles hyphenated names by splitting on hyphens', () => {
    // "BL-18" → "BL", "18" → initials "B1"
    expect(abbreviateFixtureName('BL-18')).toBe('B1')
  })

  it('handles underscored names by splitting on underscores', () => {
    expect(abbreviateFixtureName('rgb_flood')).toBe('RF')
  })

  it('returns uppercase', () => {
    const result = abbreviateFixtureName('mini wash')
    expect(result).toBe(result.toUpperCase())
  })

  it('falls back to first 3 chars when all words are noise', () => {
    // "LED Stage Light" → all noise → fallback to "LED"
    expect(abbreviateFixtureName('LED Stage Light')).toBe('LED')
  })

  it('handles empty string gracefully', () => {
    expect(abbreviateFixtureName('')).toBe('')
  })

  it('handles "36 LED Stage Light" — numeric first word survives', () => {
    // "36 LED Stage Light" → remove "LED", "Stage", "Light" → "36" → first 3 chars "36"
    expect(abbreviateFixtureName('36 LED Stage Light')).toBe('36')
  })

  it('caps at 3 initials for many-word names', () => {
    // "Alpha Beta Gamma Delta" → 4 words → first 3 initials "ABG"
    expect(abbreviateFixtureName('Alpha Beta Gamma Delta')).toBe('ABG')
  })

  it('handles single character name', () => {
    expect(abbreviateFixtureName('X')).toBe('X')
  })
})

describe('getChannelLabelData', () => {
  it('returns address for empty channel (no fixture)', () => {
    expect(getChannelLabelData(10, null)).toBe(10)
  })

  it('returns address at offset 0 (start channel)', () => {
    const info = { fixture: { name: 'SLM70S Moving Head', channelCount: 13 }, offset: 0 }
    expect(getChannelLabelData(40, info)).toBe(40)
  })

  it('returns abbreviation at offset 1 for multi-channel fixture', () => {
    const info = { fixture: { name: 'SLM70S Moving Head', channelCount: 13 }, offset: 1 }
    expect(getChannelLabelData(41, info)).toBe('SLM')
  })

  it('returns address at offset > 1', () => {
    const info = { fixture: { name: 'SLM70S Moving Head', channelCount: 13 }, offset: 5 }
    expect(getChannelLabelData(45, info)).toBe(45)
  })

  it('returns address only for single-channel fixture (no offset 1)', () => {
    const info = { fixture: { name: 'Dimmer', channelCount: 1 }, offset: 0 }
    expect(getChannelLabelData(100, info)).toBe(100)
  })

  it('returns address for 2-channel fixture at offset 0', () => {
    const info = { fixture: { name: 'Fog Machine', channelCount: 2 }, offset: 0 }
    expect(getChannelLabelData(50, info)).toBe(50)
  })

  it('returns abbreviation for 2-channel fixture at offset 1', () => {
    const info = { fixture: { name: 'Fog Machine', channelCount: 2 }, offset: 1 }
    expect(getChannelLabelData(51, info)).toBe('FM')
  })
})
