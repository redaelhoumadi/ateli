/**
 * Génération et rendu EAN-13 en pur JavaScript/SVG
 * Aucune dépendance externe
 */

// ─── EAN-13 encoding tables ───────────────────────────────────
const L_CODES: Record<string, string> = {
  '0':'0001101','1':'0011001','2':'0010011','3':'0111101','4':'0100011',
  '5':'0110001','6':'0101111','7':'0111011','8':'0110111','9':'0001011',
}
const G_CODES: Record<string, string> = {
  '0':'0100111','1':'0110011','2':'0011011','3':'0100001','4':'0011101',
  '5':'0111001','6':'0000101','7':'0010001','8':'0001001','9':'0010111',
}
const R_CODES: Record<string, string> = {
  '0':'1110010','1':'1100110','2':'1101100','3':'1000010','4':'1011100',
  '5':'1001110','6':'1010000','7':'1000100','8':'1001000','9':'1110100',
}
// First digit parity pattern (L=0, G=1)
const PARITY: Record<string, string> = {
  '0':'LLLLLL','1':'LLGLGG','2':'LLGGLG','3':'LLGGGL','4':'LGLLGG',
  '5':'LGGLLG','6':'LGGGLL','7':'LGLGLG','8':'LGLGGL','9':'LGGLGL',
}

// ─── Compute EAN-13 check digit ───────────────────────────────
export function ean13CheckDigit(digits: string): number {
  const d = digits.slice(0, 12)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(d[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

// ─── Generate a unique EAN-13 from product data ───────────────
export function generateEAN13(brandId: string, productRef: string): string {
  // Prefix: 200-299 (internal use codes)
  const prefix = '200'

  // Encode brandId and ref into 9 digits
  let hash = 0
  const combined = (brandId + productRef).replace(/[^a-zA-Z0-9]/g, '')
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) & 0xFFFFFFFF
  }
  // Take absolute value, pad to 9 digits
  const body = Math.abs(hash).toString().padStart(9, '0').slice(-9)
  const partial = prefix + body  // 12 digits
  const check   = ean13CheckDigit(partial)
  return partial + check
}

// ─── Validate EAN-13 ──────────────────────────────────────────
export function validateEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  const expected = ean13CheckDigit(code)
  return parseInt(code[12]) === expected
}

// ─── Encode EAN-13 to bar pattern ────────────────────────────
export function encodeEAN13(code: string): string | null {
  if (!/^\d{13}$/.test(code)) return null
  const first = code[0]
  const left  = code.slice(1, 7)
  const right = code.slice(7, 13)
  const parity = PARITY[first]

  let bars = '101' // start guard
  for (let i = 0; i < 6; i++) {
    bars += parity[i] === 'L' ? L_CODES[left[i]] : G_CODES[left[i]]
  }
  bars += '01010' // center guard
  for (let i = 0; i < 6; i++) {
    bars += R_CODES[right[i]]
  }
  bars += '101' // end guard
  return bars  // 95 modules
}

// ─── Render EAN-13 to SVG string ─────────────────────────────
export type BarcodeOptions = {
  width?:       number   // total SVG width (default 200)
  height?:      number   // bar height (default 80)
  fontSize?:    number   // digit font size (default 10)
  showText?:    boolean  // show human-readable digits (default true)
  background?:  string
  lineColor?:   string
}

export function renderEAN13SVG(code: string, opts: BarcodeOptions = {}): string | null {
  const bars = encodeEAN13(code)
  if (!bars) return null

  const {
    width     = 200,
    height    = 80,
    fontSize  = 10,
    showText  = true,
    background = '#ffffff',
    lineColor  = '#000000',
  } = opts

  const TEXT_H     = showText ? fontSize + 4 : 0
  const totalH     = height + TEXT_H + 4
  const MODULES    = 95
  const QUIET_LEFT = 11  // modules de silence gauche
  const QUIET_RIGHT = 7

  const totalModules = QUIET_LEFT + MODULES + QUIET_RIGHT
  const moduleW      = width / totalModules
  const barH         = height
  const guardH       = barH + (showText ? 6 : 0)

  const rects: string[] = []

  // Draw bars
  let x = QUIET_LEFT * moduleW
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === '1') {
      // Determine if it's a guard bar (longer)
      const isGuard = (i < 3) || (i >= 45 && i <= 49) || (i >= 92)
      const bh = isGuard ? guardH : barH
      rects.push(`<rect x="${x.toFixed(2)}" y="2" width="${moduleW.toFixed(2)}" height="${bh}" fill="${lineColor}"/>`)
    }
    x += moduleW
  }

  // Human-readable text
  let textSVG = ''
  if (showText) {
    const ty = height + fontSize + 4
    // First digit (left of bars)
    const firstX = (QUIET_LEFT - 1) * moduleW
    textSVG += `<text x="${firstX.toFixed(1)}" y="${ty}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="${lineColor}">${code[0]}</text>`

    // Left group (digits 2-7)
    const leftStart = (QUIET_LEFT + 3) * moduleW
    const leftEnd   = (QUIET_LEFT + 3 + 42) * moduleW
    const leftMid   = (leftStart + leftEnd) / 2
    textSVG += `<text x="${leftMid.toFixed(1)}" y="${ty}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="${lineColor}" letter-spacing="1">${code.slice(1, 7)}</text>`

    // Right group (digits 8-13)
    const rightStart = (QUIET_LEFT + 3 + 42 + 5) * moduleW
    const rightEnd   = (QUIET_LEFT + 3 + 42 + 5 + 42) * moduleW
    const rightMid   = (rightStart + rightEnd) / 2
    textSVG += `<text x="${rightMid.toFixed(1)}" y="${ty}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="${lineColor}" letter-spacing="1">${code.slice(7, 13)}</text>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">
  <rect width="${width}" height="${totalH}" fill="${background}"/>
  ${rects.join('\n  ')}
  ${textSVG}
</svg>`
}

// ─── React component ──────────────────────────────────────────
export type BarcodeSVGProps = {
  code:      string
  width?:    number
  height?:   number
  showText?: boolean
  className?: string
}
