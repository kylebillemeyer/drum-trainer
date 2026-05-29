Generate a concise handoff document capturing the current session's ephemeral state — branch, recent work, and what to pick up next. Persistent project context lives in CLAUDE.md files and docs/vision.md and does not need to be repeated here.

Steps:

1. Run `git status`, `git log --oneline -10`, and `git branch` to capture the current branch, any uncommitted changes, and recent commits.
2. Run `gh pr list --state open` and `gh issue list --state open` to get current PR and issue state.
3. Run `git diff main...HEAD --stat` to summarise what has changed on this branch vs main.

Then write (or overwrite) `HANDOFF.md` in the project root with the following structure. Be terse — bullet points, no prose padding.

---

```markdown
# Handoff — <date>

## Branch / PR
- Current branch and what it contains
- Open PR number and link if one exists
- Any uncommitted changes worth noting

## What was worked on
Bullet list of concrete things completed or changed this session.

## Current status
- What is working right now
- What is visibly broken or incomplete

## Next task
The single most logical thing to pick up, with the GitHub issue number. One sentence on why it's first.

## Session-specific decisions
Any non-obvious choices made this session that aren't yet captured in docs/vision.md or CLAUDE.md. If nothing, omit this section.
```

---

After writing the file, print the path and a one-line summary of what was captured.
