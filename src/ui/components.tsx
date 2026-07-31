// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Themed primitives, matching the web client's component classes one-for-one:
 * `.auth-pill`, `.auth-pill-secondary`, `.apple-input`, `.auth-title`, the chat
 * row and the message bubbles. Numbers come from src/ui/theme.ts, which
 * transcribes globals.css — nothing here invents its own spacing or radius.
 */

import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dark, light, metrics, radius, space, text, type Palette } from './theme'

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}

/** Screen root; owns the safe-area insets so no screen repeats them. */
export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        { flex: 1, backgroundColor: p.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** `.auth-hero` — a narrow, centred column. */
export function AuthHero({ children }: { children: ReactNode }) {
  return (
    <View style={{ width: '100%', maxWidth: metrics.authMaxWidth, alignSelf: 'center', gap: space.md }}>
      {children}
    </View>
  )
}

/** `.auth-title` */
export function AuthTitle({ children }: { children: ReactNode }) {
  const p = usePalette()
  return (
    <Text
      style={{
        textAlign: 'center',
        fontSize: metrics.authTitleSize,
        fontWeight: '700',
        letterSpacing: metrics.authTitleSpacing,
        lineHeight: metrics.authTitleSize * 1.1,
        color: p.textPrimary,
      }}
    >
      {children}
    </Text>
  )
}

/** `.auth-hint` */
export function AuthHint({ children }: { children: ReactNode }) {
  const p = usePalette()
  return (
    <Text
      style={{
        textAlign: 'center',
        fontSize: metrics.authHintSize,
        lineHeight: metrics.authHintSize * 1.5,
        color: p.textMuted,
      }}
    >
      {children}
    </Text>
  )
}

/** `.apple-input` with `.auth-field-label` */
export function Field(props: TextInputProps & { label?: string }) {
  const p = usePalette()
  const { label, style, ...rest } = props
  return (
    <View>
      {label ? (
        <Text
          style={{
            fontSize: metrics.labelSize,
            fontWeight: '600',
            color: p.textSecondary,
            marginBottom: space.sm,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={p.textMuted}
        {...rest}
        style={[
          {
            width: '100%',
            backgroundColor: p.surfaceStrong,
            borderWidth: 1,
            borderColor: p.border,
            borderRadius: radius.md,
            paddingVertical: metrics.inputPaddingV,
            paddingHorizontal: metrics.inputPaddingH,
            fontSize: metrics.inputFontSize,
            color: p.textPrimary,
          },
          style,
        ]}
      />
    </View>
  )
}

/** `.auth-pill` / `.auth-pill-secondary` — fully rounded, 50px tall. */
export function Pill({
  title,
  onPress,
  busy,
  disabled,
  variant = 'primary',
}: {
  title: string
  onPress: () => void
  busy?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  const p = usePalette()
  const off = disabled || busy
  const primary = variant === 'primary'
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({
        width: '100%',
        minHeight: metrics.pillHeight,
        borderRadius: radius.pill,
        paddingVertical: metrics.pillPaddingV,
        paddingHorizontal: metrics.pillPaddingH,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? (off ? p.accentDisabled : p.accent) : pressed ? p.surfaceAlt : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: p.border,
        opacity: pressed && primary ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={primary ? p.accentContrast : p.textPrimary} />
      ) : (
        <Text
          style={{
            fontSize: metrics.pillFontSize,
            fontWeight: primary ? '600' : '500',
            letterSpacing: 0.15,
            color: primary ? p.accentContrast : p.textPrimary,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

/** `.auth-or` — a label between two rules. */
export function OrDivider({ label }: { label: string }) {
  const p = usePalette()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
      <Text style={{ fontSize: 12, color: p.textMuted }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
    </View>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  const p = usePalette()
  if (!children) return null
  return (
    <Text style={{ color: p.textSecondary, fontSize: 14, textAlign: 'center' }}>{children}</Text>
  )
}

/** The one accent in the palette: presence. */
export function OnlineDot({ online }: { online: boolean }) {
  const p = usePalette()
  return (
    <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: online ? p.hl : p.textMuted }} />
  )
}

/** `Avatar` — md is w-10 h-10 in the web primitive. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const p = usePalette()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: p.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: p.textSecondary, fontWeight: '600', fontSize: size * 0.36 }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  )
}

/** A circular icon button, as used across the web headers (w-9 h-9 / w-10 h-10). */
export function IconButton({
  glyph,
  onPress,
  size = 36,
  emphasis = 'muted',
}: {
  glyph: string
  onPress: () => void
  size?: number
  emphasis?: 'muted' | 'primary'
}) {
  const p = usePalette()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? p.surfaceAlt : 'transparent',
      })}
    >
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62, color: emphasis === 'primary' ? p.textPrimary : p.textMuted }}>
        {glyph}
      </Text>
    </Pressable>
  )
}

export { text, space, radius, metrics }
