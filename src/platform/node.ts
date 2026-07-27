// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

import { webcrypto } from 'node:crypto'
import type { PlatformCrypto } from './adapter'

/**
 * Node reference adapter, used by the test suite. It uses the same SubtleCrypto
 * PBKDF2 call the web client uses — which is also what react-native-quick-crypto
 * exposes on device — so the three implementations stay one line apart.
 */
export const nodePlatform: PlatformCrypto = {
  async pbkdf2(password, salt, iterations, keyLenBytes) {
    const keyMaterial = await webcrypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits'])
    const bits = await webcrypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      keyLenBytes * 8
    )
    return new Uint8Array(bits)
  },

  randomBytes(length) {
    return webcrypto.getRandomValues(new Uint8Array(length))
  },
}
