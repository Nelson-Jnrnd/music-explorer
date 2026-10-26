# Approved implementation scope

On 2026-10-26, Nelson supplied the functional specification v1 and requested its implementation in this repository. That request authorizes the stated browser-only stack and contextual behavior, including recent-path Fits, looping pending candidates, occurrence-based branching, album art, local files and explicit historical imports. The specification is canonical in `docs/specifications/Music_Explorer_v1.md`.

Implementation uses standard project mode. The conservative feature-ranking fallback is already allowed by specification §2.5; it does not enable Spotify audio-feature analysis. Real Spotify account setup is owned by the user. Prepare manual deployment without publishing publicly as part of implementation. Independent review and merge/release decisions remain distinct.
