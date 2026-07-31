// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

// Polyfills FIRST — registers the native CSPRNG before any crypto is touched.
import '../src/polyfills'

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '../src/store/session'
import { dark, light } from '../src/ui/theme'

export default function RootLayout() {
  const scheme = useColorScheme()
  const palette = scheme === 'dark' ? dark : light

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {/* Screens draw their own headers, so the navigator stays out of the way. */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
            animation: 'slide_from_right',
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  )
}
