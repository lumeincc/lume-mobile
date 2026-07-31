// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Design tokens, mirrored from the web client's globals.css so both clients look
 * like one product. Values are copied rather than reinterpreted — a "close
 * enough" palette is how two clients drift into looking like two apps.
 *
 * The palette is deliberately monochrome: `hl` is the single accent, used for the
 * online dot and little else.
 */

export interface Palette {
  background: string
  surface: string
  surfaceAlt: string
  border: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentContrast: string
  accentDisabled: string
  hl: string
  danger: string
  bubbleOut: string
  bubbleOutText: string
  bubbleIn: string
  bubbleInText: string
}

export const light: Palette = {
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceAlt: 'rgba(11, 11, 11, 0.04)',
  border: 'rgba(11, 11, 11, 0.12)',
  textPrimary: '#0b0b0b',
  textSecondary: 'rgba(11, 11, 11, 0.72)',
  textMuted: 'rgba(11, 11, 11, 0.48)',
  accent: '#0b0b0b',
  accentContrast: '#ffffff',
  accentDisabled: 'rgba(11, 11, 11, 0.25)',
  hl: '#16a34a',
  danger: '#dc2626',
  bubbleOut: '#0b0b0b',
  bubbleOutText: '#ffffff',
  bubbleIn: '#ffffff',
  bubbleInText: '#0b0b0b',
}

export const dark: Palette = {
  background: '#050505',
  surface: '#0f0f0f',
  surfaceAlt: 'rgba(247, 247, 247, 0.06)',
  border: 'rgba(247, 247, 247, 0.14)',
  textPrimary: '#f7f7f7',
  textSecondary: 'rgba(247, 247, 247, 0.78)',
  textMuted: 'rgba(247, 247, 247, 0.52)',
  accent: '#f7f7f7',
  accentContrast: '#050505',
  accentDisabled: 'rgba(247, 247, 247, 0.25)',
  hl: '#4ade80',
  danger: '#f87171',
  bubbleOut: '#f7f7f7',
  bubbleOutText: '#050505',
  bubbleIn: '#1a1a1a',
  bubbleInText: '#f7f7f7',
}

export const radius = { md: 16, lg: 22, pill: 999 } as const

export const text = { micro: 10, caption: 11, body: 13, title: 17, display: 22 } as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const
