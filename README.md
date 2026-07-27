# LUME Mobile

The native LUME client — **React Native / Expo**. A real native app (native views, native keystore, native push), **not** the web PWA in a wrapper.

The rule that shapes this repo: **the cryptography is never reimplemented.** The audited crypto core is shared with the web client verbatim; only the UI and a thin platform adapter are new.

## Sharing strategy — vendored core + shared test vectors

The crypto core (`src/crypto/`) is copied **verbatim** from the web client (`lume-internal/client/src/crypto`). The web client's crypto **test suite is copied too** and runs here unchanged, so any drift between the two copies is caught by a failing vector.

Why a separate repo and a copy (not a monorepo): turning the deployed web repo into a workspace risks its Vercel build, and the crypto core is stable post-audit. If keeping the copy in sync ever gets painful, we extract a shared `@lume/crypto` package then.

**Keeping it in sync:** when the web crypto changes, re-copy `src/crypto/*` and the `crypto.*.test.ts` files and re-run `npm test`. Green means the port still matches.

## Architecture

```
src/
  crypto/         vendored, verbatim — keys · ratchet · mnemonic · safetyNumber · keyVault
                  (+ storage.ts: the seam placeholder keyVault needs)
  platform/       the OS seam
    adapter.ts    PlatformCrypto interface (pbkdf2, randomBytes)
    node.ts       Node reference impl (used by tests)
  identity.ts     master-key derivation (the portable slice of the web storage.ts)
  __tests__/      the web client's crypto vectors + the seam test
```

Everything platform-specific goes through `PlatformCrypto`, so the vendored core stays byte-identical across web, Node (tests) and React Native. The web uses SubtleCrypto + IndexedDB; Node uses `node:crypto`; React Native will use `react-native-quick-crypto` (PBKDF2) + `react-native-get-random-values` (CSPRNG) + SQLite/MMKV + the OS keystore.

## Status

**Crypto foundation — done and verified.** `npm test` → **115 passing** (keys 28 · ratchet 34 · mnemonic 39 · safetyNumber 10 · seam 4). This proves the core ports to a non-browser runtime unchanged and the adapter seam works.

Not yet built: the Expo app shell, the React Native adapter, and the UI.

```bash
npm test        # runs the vendored vectors + seam under Node
```

## Next steps

1. **Expo app shell** — `npx create-expo-app` (dev build, not Expo Go; we need custom native modules), Expo Router for file-based screens.
2. **React Native adapter** — implement `PlatformCrypto` with `react-native-quick-crypto` + `react-native-get-random-values`; add storage (SQLite/MMKV) and secure key storage (`expo-secure-store`, Keystore-backed — this also raises the at-rest ceiling from the PIN-only bound).
3. **Walking skeleton** — a screen that creates an identity from a BIP39 mnemonic and derives the master key on device, wiring the verified core to real native crypto.
4. **UI** — port the screens (setup · unlock · chats · chat · settings) to React Native; reuse the stores, API and WebSocket clients (all portable).
5. **Push** — native FCM via `expo-notifications`.

## Licence

Source-available, view-only — same terms as LUME (see the LICENSE in the main LUME repository). Not open-source.
