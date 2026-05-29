Generate a concise handoff document for a fresh Claude Code session to continue work on this project. The file should be context-efficient — a new agent should be able to read it and immediately understand the project, current state, and where to pick up.

Follow these steps:

1. Run `git status`, `git log --oneline -10`, and `git branch` to understand the current branch and recent commits.
2. Run `gh issue list --state open` to get the open GitHub issues.
3. Read `SPEC.md`, `docs/vision.md`, and `README.md` for project context.
4. Scan `frontend/src/` to understand the current file structure.

Then write a file called `HANDOFF.md` in the project root with the following sections. Be terse — bullet points over prose, no fluff.

---

## HANDOFF.md structure

```markdown
# Handoff — <project name>

_Generated <date>. For use as context in a fresh Claude Code session._

## What this project is
One short paragraph. What are we building and why.

## Current state
- Active branch and what it contains
- What has been built and is working
- What is visibly incomplete or broken

## Key decisions made
Bullet list of non-obvious architectural and design decisions, with brief rationale. Skip anything self-evident from reading the code.

## Open issues (GitHub)
Numbered list matching the GitHub issues, each one line.

## What to work on next
The single most logical next task, and why it unblocks everything else.

## Critical files
Short list of files a new agent should read first to get oriented, with one-line descriptions.

## Gotchas
Any non-obvious constraints, workarounds, or things that burned time and should not be repeated.
```

---

After writing the file, print the path and a one-line summary of what was captured.
