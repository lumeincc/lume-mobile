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

**Crypto foundation — done and verified.** `npm test` → **118 passing** (keys 28 · ratchet 34 · mnemonic 39 · safetyNumber 10 · seam 4 · onboarding 3). Proves the core ports to a non-browser runtime unchanged, the adapter seam works, and the on-device identity flow is wired to the real core.

```bash
npm test        # runs the vendored vectors + seam + onboarding under Node
```

**App shell — written, needs a device to validate.** Expo Router screens + the React Native adapter are in the repo but have NOT been run (React Native can't run headless in CI). The walking-skeleton screen (`app/index.tsx`) creates an identity and derives the master key on device via native crypto.

- `app/` — Expo Router: `_layout.tsx` (loads polyfills first) + `index.tsx` (walking skeleton)
- `src/platform/reactNative.ts` — the RN adapter (quick-crypto PBKDF2 + native CSPRNG)
- `src/polyfills.ts`, `app.json`, `babel.config.js`

### Run the app (on your machine)

```bash
npm install
npx expo install --fix     # pins Expo-SDK-correct versions of the RN deps
npx expo run:android       # a dev build (NOT Expo Go — quick-crypto is a native module)
```

> The RN dependency versions in `package.json` are a best-effort Expo SDK 52 set; `npx expo install --fix` reconciles them. `react-native-quick-crypto` has native setup — see its docs; confirm the import shape in `src/platform/reactNative.ts` matches the version you install.

## Next steps

1. **Validate the walking skeleton** on an emulator/device — confirm identity generation + PBKDF2 run on native crypto.
2. **Storage adapter** — SQLite/MMKV for the vault + `expo-secure-store` (Keystore-backed) for the most sensitive keys (also raises the at-rest ceiling beyond the PIN bound).
3. **Port the screens** (unlock · chats · chat · settings) — reuse the stores, API and WebSocket clients (all portable).
4. **Push** — native FCM via `expo-notifications`.

## Licence

Source-available, view-only — same terms as LUME (see the LICENSE in the main LUME repository). Not open-source.
