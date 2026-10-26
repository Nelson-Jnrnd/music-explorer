# Artifact publication and transport recovery

Applies to images, archives, generated documents, datasets and multi-file outputs. Do not transfer secrets or private user data into inappropriate systems.

1. Create a manifest for multi-file outputs: expected path, source hash where available, byte size, intended branch/ref, and publication status.
2. Publish in bounded sets. Verify each file belongs to a reachable commit on the intended branch. Distinguish locally generated, uploaded, committed, validated and approved states.
3. Preserve accepted originals and provenance. On failure, inspect remote state and reuse completed objects before retrying. Never regenerate accepted/recoverable outputs solely because upload or download failed.
4. Serialize writes to a single branch; check current head and use expected-head safeguards where supported. Resolve conflicting changes rather than force-pushing blindly.
5. Identify the actual failed stage (generation, blob upload, commit/ref update, download, decoding, rendering, packaging). After an initial transport failure, make **at most one materially different recovery attempt** in that session; then checkpoint the limitation and switch method or proceed with independent work.
6. **Never embed large base64/data URLs in source code, generated shell commands, model messages, cross-runtime code arguments or handoffs.** Transfer bytes as binary/structured data where the tool supports it, or verify committed originals with repository-side CI. Do not print complete image payloads to logs.
7. Before claiming delivery, verify exact committed paths, expected hashes as appropriate, full decoding/opening of deliverables and no unintended modifications. A screenshot is visual review evidence, not proof of original-byte integrity.
8. Record incident, verified commit, missing work, next action and pending review/approval in PR Handoff. Do not repeat blocked operations indefinitely or report an unverified success.

Task-specific media/source approval or legal requirements, when any, belong to the project and do not become generic assumptions here.
