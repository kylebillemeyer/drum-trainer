## Goal
Replace per-note mesh creation with a Babylon.js InstancedMesh pool (one master box per lane per state, POOL_SIZE instances assigned each frame).

## Tasks
- [ ] Restore `getCurrentTime`, `playedUpTo`, `lookaheadSeconds` props dropped in Phase 1
- [ ] Add `PBRMaterial`, `Mesh`, `InstancedMesh` imports from `@babylonjs/core`
- [ ] Add `POOL_SIZE = 64` constant and `LanePool` type
- [ ] Create two PBR master meshes + instance pools per lane at scene init
- [ ] Implement `visibleNotesInWindow` binary-search generator
- [ ] Replace stub render loop with per-frame instance positioning
- [ ] Run `npx tsc --noEmit` — must pass
- [ ] Open PR with `Closes #23`

## Decisions / blockers
- Depends on Phase 1 (#22, feat/issue-22). Rebased feat/issue-23 onto feat/issue-22 to get the Babylon.js foundation.
