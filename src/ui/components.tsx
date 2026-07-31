// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Themed primitives. Every screen builds from these so spacing, radii and colour
 * come from the tokens rather than being retyped per screen.
 */

import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dark, light, radius, space, text, type Palette } from './theme'

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}

/**
 * Screen root. Applies the safe-area insets once here rather than per screen, so
 * nothing hides under the status bar or the gesture handle.
 */
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

export function Title({ children }: { children: ReactNode }) {
  const p = usePalette()
  return <Text style={{ fontSize: text.display, fontWeight: '600', color: p.textPrimary }}>{children}</Text>
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const p = usePalette()
  return (
    <Text style={{ fontSize: text.body, color: muted ? p.textMuted : p.textSecondary, lineHeight: 19 }}>
      {children}
    </Text>
  )
}

export function Field(props: TextInputProps & { label?: string }) {
  const p = usePalette()
  const { label, style, ...rest } = props
  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Text style={{ fontSize: text.caption, color: p.textMuted, letterSpacing: 0.3 }}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={p.textMuted}
        {...rest}
        style={[
          {
            borderWidth: 1,
            borderColor: p.border,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            fontSize: 16,
            color: p.textPrimary,
            backgroundColor: p.surface,
          },
          style,
        ]}
      />
    </View>
  )
}

export function Button({
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
  variant?: 'primary' | 'ghost'
}) {
  const p = usePalette()
  const off = disabled || busy
  const primary = variant === 'primary'
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({
        backgroundColor: primary ? (off ? p.accentDisabled : p.accent) : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: p.border,
        borderRadius: radius.md,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={primary ? p.accentContrast : p.textPrimary} />
      ) : (
        <Text
          style={{
            color: primary ? p.accentContrast : p.textPrimary,
            fontWeight: '600',
            fontSize: 15,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  const p = usePalette()
  if (!children) return null
  return <Text style={{ color: p.danger, fontSize: text.body }}>{children}</Text>
}

/** The one accent in the palette: presence. */
export function OnlineDot({ online }: { online: boolean }) {
  const p = usePalette()
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: radius.pill,
        backgroundColor: online ? p.hl : p.textMuted,
      }}
    />
  )
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
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
      <Text style={{ color: p.textSecondary, fontWeight: '600', fontSize: size * 0.38 }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  )
}

export const layout = StyleSheet.create({
  padded: { paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
})
