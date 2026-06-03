## Goal
Refactor the flat PixiJS DrumHighway to use persistent stage objects and a fixed gem pool instead of rebuilding all objects every frame.

## Tasks
- [x] Create AGENT_PLAN.md and commit
- [x] Refactor `DrumHighway.tsx`: move lane backgrounds, labels, hit zone, and note gems to init; replace per-frame reconstruction with pool-based ticker
- [x] Verify `app.stage.removeChildren()` is not called anywhere in the component
- [x] Run `npx tsc --noEmit` and confirm no new errors
- [x] Commit implementation
- [ ] Open PR with `Closes #24`, add `needs-review`, remove `in-progress`

## Decisions / blockers
None so far.
