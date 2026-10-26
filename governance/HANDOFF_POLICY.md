# Task handoffs and recovery

A draft PR is the durable restart checkpoint for an in-progress task. Create it after the first coherent push. Keep its **Handoff** section up to date after each meaningful commit/push; never depend on a conversation retaining all context.

## Required handoff fields

1. Branch and last **reachable** pushed commit SHA.
2. Completed work and changed paths.
3. Remaining acceptance criteria and known blockers.
4. Exact next action, with commands/paths.
5. Commands actually run and their outputs/results; mark unexecuted checks explicitly.
6. Open questions, linked decisions and dependencies; separate pending human approval from reviewer approval and merge authorization.

## Resume algorithm

Read current `main` governance and issue, inspect remote branch/PR/commit, compare handoff with real committed files and CI. Check for upstream changes and conflicts. Continue only missing work. If previous attempt reported success without durable evidence, verify it before relying on it. Never rewrite a shared branch without checking the current head.

## Failure discipline

Classify failure (tool authorization, fetch, computation, upload, commit, download, decode, validation). Preserve durable checkpoints; perform at most one materially different retry for a repeated transport failure in the session before switching method or recording a blocker. Don't regenerate recoverable assets or rerun an entire queue to fix a single failure. Keep independent work moving where safe.

Use `governance/ARTIFACT_RECOVERY.md` when bytes or artifacts are involved. A pushed blob that is not attached to a reachable commit is not a completed checkpoint.
