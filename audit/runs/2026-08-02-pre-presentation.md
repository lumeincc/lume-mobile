# Full verification pass, before the presentation — 2026-08-02

**Why this run happened:** the product is being shown next week; this is the
state the mobile client goes in with.
**Commit:** `df973d1` on `main`
**Device:** Samsung Galaxy S24 (SM-S921B), Android 16, arm64-v8a
**Ran by:** Claude

---

## Result

**Green.** The gate passes end to end, the vendored crypto is still identical to
the web client's, and the live relay was exercised from Node.

---

## What ran

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | clean |
| Full gate | `npm run verify` | exit 0 |
| Tests | (within `verify`) | **184 passed**, 15 files |
| Device simulation | (within `verify`) | `DEVICE SIMULATION PASSED` |
| Negative case | (within `verify`) | `NEGATIVE CASE CONFIRMED` |
| Metro bundle | (within `verify`) | 1059 modules |
| APK build | `./gradlew :app:assembleRelease` | `BUILD SUCCESSFUL in 2m 48s` |
| Install + launch | `adb install -r` then launcher intent | installed, launched, no crash |

The negative case is the one worth reading twice: it runs the identity flow with
the polyfills removed and **requires it to fail**. It did. Without that, the
simulation could pass while checking nothing.

### Against the live relay

```
npm run e2e:message
  contains the plaintext? no
  matches what A sent? true
  ciphertexts differ between messages? true
  ratchet state survived the restart? true
  E2E MESSAGE TEST PASSED

npm run e2e:realtime
  pushed to B in 835ms
  REALTIME TEST PASSED
```

### Vendored crypto

Compared against `lume-internal/client/src/crypto/` — **all six files identical**:
`ratchet.ts`, `keys.ts`, `keyVault.ts`, `mnemonic.ts`, `safetyNumber.ts`,
`spkRotation.ts`.

`ratchet.ts` was touched this session (a comment) and re-synced in `df973d1`, so
this comparison is the check that the sync actually landed rather than an
assumption that it did.

---

## Could not verify

- **The app icon on a home screen other than this launcher.** Samsung's launcher
  applies its own squircle mask; the icon was confirmed there, but Pixel and
  other launchers crop differently and were not tested.
- **Notifications.** Not built on mobile at all, so nothing to verify — noted so
  it is not mistaken for an untested feature.
- **Anything on iOS.** No build, no device, not attempted.
- **Behaviour on a genuinely bad network.** The outbox, the request timeout and
  the reconnect logic are covered by unit tests, but no run put the app on a
  failing connection on real hardware.

---

## Measurements

All on the Galaxy S24 above, against the live relay.

| What | Value | Produced by |
|---|---|---|
| Tests | 184 across 15 files | `npm test` |
| Message delivery, send → decrypted | 835 ms | `npm run e2e:realtime` |
| Vault unlock | ~319 ms at 600 000 PBKDF2 iterations | on-device, native Kotlin module |
| Same derivation in pure JS | 69 182 ms | on-device, before the native module |
| Unlock + signed request to relay | 1856 ms | `npm run relay:check` |
| Account creation | ~14 s, once | on-device |
| Release APK | 74.7 MB | `./gradlew :app:assembleRelease` |
| Build time, incremental | 2 m 48 s | same |

The 69 182 ms figure is kept deliberately. It is the reason the native module
exists, and it is the clearest evidence that the device simulation validates
correctness and not speed — the same code took about a second on the laptop.

---

## Findings

No new defects. Fixed earlier in the session, each reproduced first by a test
that fails without its fix:

- **The typeface never loaded.** `useFonts` resolves the bundled `.ttf` through
  `expo-asset`, which needs `expo-file-system` linked — this project does not
  have it, so the call was rejected and the deliberate fallback swallowed the
  error. The app rendered in Roboto with a clean log. Caught only by magnifying a
  device screenshot. Fixed by embedding the fonts at build time via the
  `expo-font` config plugin, which removes the runtime path entirely.
- **The app had no icon** and shipped Expo's default. Now `logo 2` itself, with
  an adaptive foreground inset 14% so Android's crop does not eat the corona.
- **Demo strings switched to English** so the transcript quoted in the public
  material matches a run that actually happened.

---

## Follow-ups

- Not built: settings screen, safety-number verification, notifications,
  attachments, groups.
- Account creation at ~14 s is the next candidate for native work — 21 X25519
  keypairs plus the seed derivation — if it ever matters. It happens once.
- Securex has not reviewed the ratchet serialisation work (`lume-internal`
  PR #166) or the key-storage design. Both were flagged there rather than
  skipped.
