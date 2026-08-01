# Unsafe Escape Audit

**Goal:** Remove confirmed unsafe typing escapes in non-test, non-generated Torch source without replacing valid simulation invariants with vague fallbacks.

## Intent

Find unsafe escapes and fix them at the narrowest owner. Prefer discriminated unions, type guards, and explicit boundary decoding over repeated casts and nullable fallbacks. A clean pass is valid; significant typing seams remain proposals. If the scope is large, phase the plan.

## Hard stops

- Do not add new `eslint-disable`, `@ts-ignore`, or `@ts-expect-error`. If an existing suppression must remain, keep it line-scoped and explain the invariant beside it.
- Do not chase every `as`, `any`, or non-null assertion without checking whether the runtime invariant is proven and owned.
- Keep external/browser decoding at the boundary (`src/game/input-bindings.ts`, future save adapters); do not scatter casts through `src/sim/**`.
- Do not replace a confirmed state/persistence failure with a cast and call it fixed; coordinate with `BehaviorHardeningAudit.md` for the behavior impact.
- Preserve strict TypeScript contracts and the typed command/event model in `src/sim/types.ts`.

## Triage

| Priority | Examples                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| P0       | An assertion can route an invalid command, target, entity, content ID, or decoded value into simulation mutation     |
| P1       | A non-null assertion or unchecked lookup can throw on an empty/corrupt state, scene lifecycle edge, or missing asset |
| P2       | `@ts-ignore`, broad suppression, double assertion, or `any` hides a real mismatch at a module boundary               |
| P3       | Style-only assertion churn with a proven invariant and no correctness or maintenance impact                          |

Prioritize escapes on command resolution, generated-state mutation, browser input decoding, and asset/content registration.

## Domain rules

- Prefer discriminated unions and exhaustive `switch` handling for `Command`, `ActionRequest`, `SimEvent`, entity kinds, directions, and ability slots. Keep those contracts in `src/sim/types.ts` and related rule modules.
- `applyCommand` in `src/sim/simulation.ts` is the typed boundary for gameplay state. UI and Phaser code should pass commands through `GameSession`, not cast arbitrary objects into simulation types.
- Content definitions under `src/content/**` are typed source data with stable IDs. Asset IDs, equipment/tool slots, and ability slots should be narrowed before indexing maps.
- `src/game/input-bindings.ts` decodes JSON from `localStorage`; runtime checks already narrow arrays and strings. Treat parsed JSON as untrusted at this boundary: a narrow intermediate assertion such as `Partial<Record<KeyBindingAction, unknown>>` is acceptable only when every field is checked before use, while `as KeyBindings` is not a decoder and must not replace malformed-input handling.
- `src/game/scene.ts` uses definite assignment for Phaser objects created during scene setup. Keep such assertions only when the lifecycle guarantees initialization before use; replace event-driven optional state with explicit guards.
- `structuredClone` at the command boundary is an intentional isolated-state operation. Do not add `any` or `unknown` to avoid modeling a `GameState` field.
- There is no durable save decoder in the current Phase 1 slice. When one is added, make its versioned envelope and validation the single boundary rather than adding call-site casts.
- Directional targets are guidance, not gates: reduce unsafe escapes over time while preserving useful impossible-state invariants. Never add fake fallbacks that let invalid gameplay continue.

## Known signals

Optional discovery aids — choose probes that fit the candidate.

- **Compiler diagnostics:** `npm run typecheck` (`strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are enabled in `tsconfig.json`).
- **Assertions and suppressions:** `rg -n "as unknown as|@ts-ignore|@ts-expect-error|eslint-disable|!\\.|![:;=]" src --glob '*.ts' --glob '*.tsx'` (include definite-assignment assertions such as `field!: Type`, not only non-null member access).
- **Broad types:** `rg -n "\\bany\\b" src --glob '*.ts' --glob '*.tsx'` (inspect comments and intentional library signatures separately).
- **Unsafe persistence/input boundaries:** casts around JSON parsing, `localStorage`, content/asset lookup, or future save adapters; confirm whether a runtime check or a typed owner is missing.
- **Unsafe simulation assumptions:** casts or non-null lookups in `src/sim/**`, especially entity IDs, target positions, generated mutations, and ability cooldown/effect maps.
- **Suppressed React/Phaser mismatches:** broad assertions in `src/ui/**`, `src/components/**`, or `src/game/**` that hide missing DOM/texture/lifecycle checks.

## Matching verification

Run the compiler and focused owner tests first, then the normal gate for a shipped fix:

```bash
npm run typecheck
npm test -- tests/simulation.test.ts tests/input-bindings.test.ts tests/context-action-hand.test.ts
npm run build
npm run verify
```

Report the category and direction of each change (`any`, suppression, assertion, or non-null), plus the invariant or runtime check that now owns it. A clean pass is successful.
