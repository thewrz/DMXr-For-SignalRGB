import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function readStylesheet(): string {
  return readFileSync(resolve(__dirname, '../../public/css/style.css'), 'utf-8')
}

export function extractRootVariables(css: string): Record<string, string> {
  const vars: Record<string, string> = {}
  const rootBlocks = css.match(/:root\s*\{[^}]+\}/g)
  if (!rootBlocks) return vars
  for (const block of rootBlocks) {
    const matches = block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)
    for (const m of matches) {
      vars[m[1].trim()] = m[2].trim()
    }
  }
  return vars
}

export function cssContains(css: string, pattern: string): boolean {
  return css.includes(pattern)
}

export function extractPropertyValue(
  css: string,
  selector: string,
  property: string
): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `${escaped}\\s*\\{[^}]*?${property}\\s*:\\s*([^;]+);`,
    's'
  )
  const m = css.match(re)
  return m ? m[1].trim() : null
}
