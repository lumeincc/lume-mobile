// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

// Polyfills FIRST — registers the native CSPRNG before any crypto is touched.
import '../src/polyfills'

import { useCallback } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
// Imported per weight rather than from the package root: the root index pulls in
// every face it ships, and Metro cannot drop the ones we never ask for — three
// unused weights, ~290 kB, would ride along in the APK.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular'
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium'
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold'
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold'
import * as SplashScreen from 'expo-splash-screen'
import { SessionProvider } from '../src/store/session'
import { dark, light } from '../src/ui/theme'

// Hold the splash until the typeface is ready. Without it the first frames draw
// in Android's Roboto and then reflow into Manrope — every label changes width
// mid-launch, which reads as a broken app rather than a slow one.
void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const scheme = useColorScheme()
  const palette = scheme === 'dark' ? dark : light

  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  })

  const onReady = useCallback(() => {
    void SplashScreen.hideAsync()
  }, [])

  // A font that fails to load must not leave a blank app: fall back to the
  // system face and carry on. Nothing here depends on the typeface working.
  if (!fontsLoaded && !fontError) return null

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: palette.background }} onLayout={onReady}>
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
      </View>
    </SafeAreaProvider>
  )
}
