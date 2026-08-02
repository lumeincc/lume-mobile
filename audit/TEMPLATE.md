# <what was checked> — YYYY-MM-DD

**Why this run happened:** <before a release / after a fix / before a demo / …>
**Commit:** `<sha>` on `<branch>`
**Device:** <model, Android version — or "none, simulation only">
**Ran by:** <name>

---

## Result

<One line. Green, red, or partial. If partial, that is a legitimate result — say
which parts could not run and why. Do not round a partial up to green.>

---

## What ran

| Check | Command | Result |
|---|---|---|
| | | |

Paste the real output for anything non-trivial — counts, failure text, timings.
Not a summary from memory.

```
<output>
```

---

## Could not verify

<Delete this section only if it is genuinely empty. A locked build, no phone
attached, an emulator that would not start — all belong here with the reason.
This section is the whole reason the file is trustworthy.>

<For anything timed: say which device. A laptop timing is not a phone timing —
Node compiles the loop that Hermes interprets, and that gap has been a factor of
200 before now.>

---

## Measurements

<Only numbers actually observed in this run, each with what produced it. Anything
that might be quoted publicly later goes here so it can be traced back.>

| What | Value | Produced by |
|---|---|---|
| | | |

---

## Findings

<Anything discovered. A bug, a regression, a surprise, a flaky test. Link the
issue or PR if one exists. If a fix went in, say whether a test was added and
whether that test was checked to fail without the fix — a test that cannot fail
proves nothing.>

---

## Follow-ups

<What is left open, and who it belongs to. Security findings go to `ledger.md`
and are Securex's, not this file's.>
