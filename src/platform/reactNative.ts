// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

import type { PlatformCrypto } from './adapter'
// react-native-quick-crypto is a JSI-backed drop-in for Node's `crypto`, so the
// 600k-iteration PBKDF2 runs natively instead of janking the JS thread. It is a
// native module — only present inside the Expo app, not this test workspace.
// NOTE: confirm the import shape against your installed quick-crypto version.
import QuickCrypto from 'react-native-quick-crypto'

/**
 * React Native implementation of the platform seam. Randomness comes from the OS
 * CSPRNG via react-native-get-random-values (installed in src/polyfills.ts,
 * before any crypto runs), which backs the global `crypto.getRandomValues` that
 * TweetNaCl and BIP39 use.
 */
export const reactNativePlatform: PlatformCrypto = {
  async pbkdf2(password, salt, iterations, keyLenBytes) {
    const derived = QuickCrypto.pbkdf2Sync(password, salt, iterations, keyLenBytes, 'sha256')
    return new Uint8Array(derived as unknown as ArrayBufferLike)
  },

  randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length))
  },
}
