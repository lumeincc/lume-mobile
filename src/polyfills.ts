// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Must be imported before any crypto runs (first line of the root layout).
 * Registers a native CSPRNG as global `crypto.getRandomValues`, which TweetNaCl
 * and BIP39 depend on. Without it, key generation on device would throw.
 */
import 'react-native-get-random-values'
