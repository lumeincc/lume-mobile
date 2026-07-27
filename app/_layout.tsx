// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

// Polyfills FIRST — registers the native CSPRNG before any crypto is touched.
import '../src/polyfills'

import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack screenOptions={{ headerTitle: 'LUME' }} />
}
