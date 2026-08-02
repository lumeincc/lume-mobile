# audit/

The record of what was checked, what was found, and what is still open — for the
mobile client.

The web client and server keep their own `audit/` in the `lume-internal`
repository, in the same shape. Each repository records its own runs; nothing is
duplicated across the two. Security findings that span both live in
`lume-internal/audit/ledger.md`, which is Securex's.

| | What it is | Who writes it |
|---|---|---|
| [`runs/`](runs/) | Test runs and verification results, dated | Claude (implementation) |
| `findings.md` | Mobile-only security findings, if any are ever opened here | **Securex only** |

---

## The one rule this folder exists to enforce

**Record only what was observed.**

A file in here is evidence. That means:

- **Never write that a check passed without having run it and read its output.**
- **"Could not verify" is its own outcome — never fold it into "passed."** A
  locked build, a disconnected phone, a missing emulator: say so, and say why.
- **Paste the real output.** Counts, failure text, timings, the command.
- **A failure is a result.** Red runs get recorded the same as green ones.

This matters more here than on the web side, because of the gap below.

## The gap this project exists around

**A green test suite on a laptop proves nothing about a phone.** Node provides
globals that Hermes does not, so crypto code can pass every unit test and still
die on the device.

Two commands close that gap and both belong in a run record:

- `npm run sim` — a separate Node process that deletes exactly the globals Hermes
  lacks, re-adds what React Native does provide, resolves modules the way Metro
  does, and then creates and recovers a real identity.
- `npm run sim:negative` — the same flow with the polyfills removed, which
  **must fail**. If it ever passes, the first check was proving nothing.

What the simulation cannot catch is **performance**: Node compiles the tight
PBKDF2 loop that Hermes interprets. A derivation taking a second on a laptop took
69 seconds on the device. Timings only count if they came from real hardware, and
a run record should say which device.

---

## Never put in here

- secrets, tokens, private keys, recovery phrases
- plaintext message content
- real user data, or `adb logcat` dumps that contain any of the above

---

## Recording a run

Copy [`TEMPLATE.md`](TEMPLATE.md) into `runs/` as `YYYY-MM-DD-short-slug.md` and
fill it in **while running**, not afterwards from memory.

Worth a record: a full verification pass, an APK built and installed, a
regression reproduced and fixed, any measurement taken on real hardware, and
anything that could not be verified.

## The commands a full pass runs

```bash
npx tsc --noEmit
npx expo-doctor
npm run verify        # test + sim + sim:negative + expo export
```

Against the live relay, from Node:

```bash
npm run relay:check      # registration + a signed authenticated request
npm run e2e:message      # encryption, what the relay stores, restart survival
npm run e2e:realtime     # delivery latency
```

Building and installing on a device:

```bash
npx expo prebuild -p android
cd android && ./gradlew :app:assembleRelease     # release, not debug
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`npm run verify` is the gate before **any** build — a cloud build costs about
fifteen minutes, and a local one a few, so failures are worth finding here.

## Vendored crypto

`src/crypto/` is copied **byte-identical** from the web client, and the web
client's own tests run here unchanged. A run record should note when the copies
were last compared:

```bash
for f in ratchet keys keyVault mnemonic safetyNumber spkRotation; do
  diff -q ../lume-internal/client/src/crypto/$f.ts src/crypto/$f.ts
done
```

If they ever differ, that is a finding, not a formality.
