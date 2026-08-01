# Async & Race Audit

**Goal:** Close confirmed async lifetime, duplicate-dispatch, and listener/timer race risks in Torch's Phaser client and React overlay without making the deterministic simulation asynchronous for style.

## Intent

Investigate high-risk candidates and fix confirmed lifetime or ordering issues. Do not add abort controllers, mutex helpers, or concurrency tests without a demonstrated race. Torch is a browser-first Phaser 4 + React 19 application: `src/sim/**` resolves commands synchronously, `src/game/session.ts` owns command dispatch and subscriptions, `src/game/scene.ts` owns Phaser presentation, and `src/ui/**` owns the overlay. Significant worker or runtime-boundary changes are proposals under [README.md](README.md) and [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Hard stops

- Do not introduce thread-blocking loops or `Atomics.wait` stalls on the browser main thread.
- Do not turn `applyCommand` or other simulation rules into async APIs. Rendering and UI can animate after a synchronous command result.
- Only add `AbortController`/cancellation when a real cancellable browser operation exists. The current client has no gameplay network request.
- Do not move simulation work into a Worker unless a measured problem and an architecture decision require it.
- React development remounts are expected. Fix duplicate subscriptions, dispatches, or grants caused by the implementation; do not “fix” the framework lifecycle.
- Idempotency of command/state transitions belongs to `BehaviorHardeningAudit.md`; this audit owns the lifetime or ordering cause. Route focus semantics to `UIInteractionFeedbackAudit.md` and frame-cost findings to `PerformanceAudit.md` once a lifetime issue is ruled out.

## Severity

| Sev | Description                                                                                               | Action                           |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------------- |
| P0  | A user action can resolve twice, or a listener/timer can mutate shared state after teardown on a hot path | Fix now                          |
| P1  | React state update after overlay unmount; stale Phaser tween, session callback, or input handler          | Fix when confirmed               |
| P2  | Missing cleanup for timers, `requestAnimationFrame`, `ResizeObserver`, DOM events, or Phaser events       | Establish ownership and teardown |
| P3  | Redundant `Promise`/`async` wrapper with no lifetime or ordering hazard                                   | Skip unless trivial              |
| P4  | Speculative Worker, queue, or cancellation abstraction                                                    | Propose only                     |

## Domain rules

**Safe patterns:** `useEffect` returns cleanup for every DOM listener, timer, animation frame, observer, and subscription it registers; `GameSession.subscribe` returns its unsubscribe function; `TorchScene` removes window/Phaser listeners, disconnects `ResizeObserver`, and stops tweens during scene shutdown; timeout and animation-frame handles are cleared when cancellable and otherwise guard against stale work after an overlay unmounts. The development frame monitor pairs `start()` with `stop()` and never installs in production. `src/sim/**` remains synchronous and deterministic.

The current checkout has no background save pipeline. Do not invent one during this audit. `localStorage` preference reads/writes in `src/game/presentation-settings.ts` and `src/game/input-bindings.ts` are browser-boundary work; malformed-value fallback or persistence semantics belong to `BehaviorHardeningAudit.md` unless teardown/order is the defect.

Presence of `Promise`, `async`, `await`, `setTimeout`, or an event listener is not itself a finding. Confirm ownership, cancellation, re-entry, and the ordering visible to the player.

## Known signals

Optional discovery aids — choose probes that fit the candidate.

- **Effects without cleanup:** `useEffect` in `src/ui/**` or `src/components/**` that registers a listener, timer, animation frame, `ResizeObserver`, or `gameSession.subscribe` without a teardown.
- **Session subscription leaks:** `gameSession.subscribe(` in React or Phaser code without retaining and calling the returned unsubscribe.
- **Phaser lifecycle leaks:** `src/game/scene.ts` handlers registered in `create` but not removed in the scene shutdown callback; tweens or observers surviving scene shutdown.
- **Double dispatch:** overlay or scene callbacks calling `gameSession.dispatch`/`move`/`wait`/`performAction` while a presentation transition is still active, without a deliberate single-flight guard.
- **Action Hand re-entry:** `src/ui/context-action-hand.tsx` can call `gameSession.performAction` while the scene is still animating a previous command. Reproduce rapid card activation during the movement/action tween before treating the missing guard as a confirmed P0/P1 race; the card's interaction contract remains owned by `UIInteractionFeedbackAudit.md`.
- **Stale callbacks:** `setTimeout`, `requestAnimationFrame`, or Promise continuations in `src/ui/menu-overlay.tsx` and `src/ui/context-action-hand.tsx` that can run after unmount or after the relevant card/menu has changed.
- **Menu focus re-entry:** `src/ui/menu-overlay.tsx` schedules nested `requestAnimationFrame` and delayed `setTimeout` focus restoration from both the close callback and the `open` effect. Confirm duplicate or stale focus after rapid transitions or development remounts before changing it; the lifetime/order cause belongs here, while the focus contract belongs to `UIInteractionFeedbackAudit.md`.
- **Development monitor lifecycle:** `src/dev/frame-monitor.ts` and its `src/main.ts` start path own a dev-only `requestAnimationFrame`/`PerformanceObserver` loop. Confirm paired stop, no duplicate start, and no callback or panel after teardown; route measured frame cost to `PerformanceAudit.md`.
- **Cross-boundary ordering:** a UI event changing `gameSession.inputMode` or preference state while a Phaser input callback can still consume the same browser event.

## Matching verification

Use the narrowest useful checks, then the normal gate for a shipped fix:

```bash
npm run typecheck
npm test -- tests/frame-monitor.test.ts tests/context-action-hand.test.ts
npm run test:e2e -- tests/e2e/first-light.spec.ts --reporter=line
npm run verify
```

If no candidate is confirmed, report a clean pass. Do not add a race test merely to make the audit non-empty.
