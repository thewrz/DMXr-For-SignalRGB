import { describe, it, expect } from 'vitest'
import {
  readStylesheet,
  extractRootVariables,
  cssContains,
  extractPropertyValue,
} from './css-parser.js'

describe('CSS Theme — SignalRGB Aesthetic', () => {
  const css = readStylesheet()
  const vars = extractRootVariables(css)

  describe('Color palette', () => {
    it('uses ultra-dark background', () => {
      expect(vars['bg']).toBe('#0f1119')
    })

    it('uses dark surface without purple tint', () => {
      expect(vars['surface']).toBe('#13141e')
      expect(vars['surface2']).toBe('#1a1b26')
    })

    it('uses teal accent instead of purple', () => {
      expect(vars['accent']).toBe('#00b8d4')
      expect(vars['accent2']).toBe('#00838f')
    })

    it('uses near-invisible border color', () => {
      expect(vars['border']).toBe('#1e1f2e')
    })

    it('uses softer text colors', () => {
      expect(vars['text']).toBe('#e0e0e4')
      expect(vars['text-dim']).toBe('#6b6e7f')
    })

    it('preserves functional status colors', () => {
      expect(vars['success']).toBe('#2ecc71')
      expect(vars['danger']).toBe('#e74c3c')
      expect(vars['warning']).toBe('#f39c12')
    })
  })

  describe('Fixture color palette — muted', () => {
    it('uses muted fixture colors', () => {
      expect(vars['fixture-color-0']).toBe('#8e6aaf')
      expect(vars['fixture-color-1']).toBe('#2d8bc9')
      expect(vars['fixture-color-2']).toBe('#27b560')
      expect(vars['fixture-color-3']).toBe('#d4721f')
      expect(vars['fixture-color-4']).toBe('#d44536')
      expect(vars['fixture-color-5']).toBe('#18a98c')
      expect(vars['fixture-color-6']).toBe('#3a4a5c')
      expect(vars['fixture-color-7']).toBe('#e0b50e')
    })
  })

  describe('Decorative elements removed', () => {
    it('has no togglePulse animation', () => {
      expect(cssContains(css, 'togglePulse')).toBe(false)
    })

    it('has no inset shadow on fixture cards', () => {
      const shadow = extractPropertyValue(css, '.fixture-card', 'box-shadow')
      expect(shadow).toBeNull()
    })

    it('has no brightness(1.4) on fixture highlight', () => {
      expect(cssContains(css, 'brightness(1.4)')).toBe(false)
    })

    it('uses subtle outline for fixture highlight', () => {
      const filter = extractPropertyValue(
        css,
        '.channel-cell.fixture-highlight',
        'filter'
      )
      expect(filter).toBe('brightness(1.15)')
    })
  })

  describe('Fixture cards — flat style', () => {
    it('uses top border instead of left border', () => {
      const borderTop = extractPropertyValue(
        css,
        '.fixture-card',
        'border-top'
      )
      expect(borderTop).toBe('2px solid var(--card-color)')
      const borderLeft = extractPropertyValue(
        css,
        '.fixture-card',
        'border-left'
      )
      expect(borderLeft).toBeNull()
    })

    it('fixture card hover uses background change', () => {
      const bg = extractPropertyValue(
        css,
        '.fixture-card:hover',
        'background'
      )
      expect(bg).toBe('var(--surface2)')
    })
  })

  describe('Border radius reduction', () => {
    it('btn has 4px radius', () => {
      expect(extractPropertyValue(css, '.btn', 'border-radius')).toBe('4px')
    })

    it('fixture-card has 6px radius', () => {
      expect(extractPropertyValue(css, '.fixture-card', 'border-radius')).toBe(
        '6px'
      )
    })

    it('empty-state has 6px radius', () => {
      expect(extractPropertyValue(css, '.empty-state', 'border-radius')).toBe(
        '6px'
      )
    })

    it('universe-map has 6px radius', () => {
      expect(extractPropertyValue(css, '.universe-map', 'border-radius')).toBe(
        '6px'
      )
    })

    it('modal has 8px radius', () => {
      expect(extractPropertyValue(css, '.modal', 'border-radius')).toBe('8px')
    })

    it('grid-tooltip has 6px radius', () => {
      expect(extractPropertyValue(css, '.grid-tooltip', 'border-radius')).toBe(
        '6px'
      )
    })

    it('status has 10px radius', () => {
      expect(extractPropertyValue(css, '.status', 'border-radius')).toBe(
        '10px'
      )
    })
  })

  describe('Typography', () => {
    it('uses Segoe UI first in font stack', () => {
      const fontFamily = extractPropertyValue(css, 'body', 'font-family')
      expect(fontFamily).toMatch(/^"Segoe UI"/)
    })
  })

  describe('Spacing adjustments', () => {
    it('fixture-list has 0.75rem gap', () => {
      expect(extractPropertyValue(css, '.fixture-list', 'gap')).toBe('0.75rem')
    })

    it('main-content has 1.25rem padding', () => {
      expect(extractPropertyValue(css, '.main-content', 'padding')).toBe(
        '1.25rem'
      )
    })
  })

  describe('Button text contrast', () => {
    it('btn-primary has dark text on teal', () => {
      expect(extractPropertyValue(css, '.btn-primary', 'color')).toBe('#000')
    })
  })

  describe('Border simplification', () => {
    it('sidebar-tabs has 1px border', () => {
      expect(
        extractPropertyValue(css, '.sidebar-tabs', 'border-bottom')
      ).toBe('1px solid var(--border)')
    })

    it('source-tabs has 1px border', () => {
      expect(
        extractPropertyValue(css, '.source-tabs', 'border-bottom')
      ).toBe('1px solid var(--border)')
    })

    it('empty-state has no border', () => {
      expect(extractPropertyValue(css, '.empty-state', 'border')).toBe('none')
    })

    it('universe-map has no border', () => {
      expect(extractPropertyValue(css, '.universe-map', 'border')).toBe('none')
    })
  })

  describe('Structural selectors preserved', () => {
    const requiredSelectors = [
      '.fixture-card',
      '.channel-grid',
      '.modal-overlay',
      '.sidebar',
      '.app-layout',
      '.btn:hover',
      '.btn:disabled',
      '.drop-target-valid',
      '.drop-target-invalid',
      '.fixture-highlight',
    ]

    for (const sel of requiredSelectors) {
      it(`contains ${sel}`, () => {
        expect(cssContains(css, sel)).toBe(true)
      })
    }
  })
})
