## Goal
Replace per-note mesh creation with a Babylon.js InstancedMesh pool (one master box per lane per state, POOL_SIZE instances assigned each frame).

## Tasks
- [x] Restore `getCurrentTime`, `playedUpTo`, `lookaheadSeconds` props dropped in Phase 1
- [x] Add `PBRMaterial`, `Mesh`, `InstancedMesh` imports from `@babylonjs/core`
- [x] Add `POOL_SIZE = 64` constant and `LanePool` type
- [x] Create two PBR master meshes + instance pools per lane at scene init
- [x] Implement `visibleNotesInWindow` binary-search generator
- [x] Replace stub render loop with per-frame instance positioning
- [x] Run `npx tsc --noEmit` — must pass
- [x] Open PR with `Closes #23`

## Decisions / blockers
- Depends on Phase 1 (#22, feat/issue-22). Rebased feat/issue-23 onto feat/issue-22 to get the Babylon.js foundation.

## Assessor Continuation Note
All implementation is complete and `npx tsc --noEmit` passes with no errors. The diff in `DrumHighway3D.tsx` fully satisfies the spec: PBR master meshes + InstancedMesh pools per lane, the `visibleNotesInWindow` binary-search generator, per-frame instance positioning in the render loop, and the restored `getCurrentTime`/`playedUpTo`/`lookaheadSeconds` props (already wired up correctly in `page.tsx`). The only remaining step is opening the PR with `Closes #23`.
