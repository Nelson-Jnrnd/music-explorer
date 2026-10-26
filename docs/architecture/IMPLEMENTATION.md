# Browser architecture and platform gate

The supplied specification authorizes React, TypeScript, Vite, React Flow and Zod. Pure domain operations produce a new state. The app serializes a transaction, validates current Spotify playback for judgments, saves the complete state, then applies it and requests the next track. Save failures retain a pending draft for retry/export and block further decisions. Spotify playback failures leave an already saved decision intact and offer explicit resume.

State normalizes track identities and distinct accepted occurrences. Node-local queues survive branch activation; past comparisons remain a separate evidence collection. Undo marks evaluations with a compensating audit event. No Spotify metadata or credentials are needed to parse a backup. Runtime metadata is lazy and transient; artwork is displayed square and unaltered, with a Spotify link.

File System Access writes use createWritable/close replacement and serialized operations. Browser recovery is a fallback with a visible warning. File handles and OAuth authorization must be renewed through explicit UI actions after reload. Version 1 is the initial persisted format; later versions require a migration before import, never silent coercion.

## Spotify policy gate (2026-10-26)

Reviewed official [2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [PKCE flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [Developer Policy](https://developer.spotify.com/policy), and [design guidance](https://developer.spotify.com/documentation/design). Account restrictions include owner Premium and five users for new development-mode apps. Bulk track endpoints are removed in development mode, so metadata uses individual visible/about-to-play tracks.

The policy page retrieval did not expose enough substantive text to establish permission for feature-based ranking. Accordingly, no Spotify-derived numerical audio feature enters scoring. No content analysis, audio download or ML training is implemented. The baseline uses explicit judgments and deterministic candidate selection. This conservative implementation is not a legal clearance for future ranking changes; review current official terms and data licensing before adding those changes.

Playback is initiated by explicit exploration actions. Native repeat-one supports the requested pending-track behavior while a user evaluates; there is no scheduled listening or automated judgment. Metadata and playback errors are surfaced, 401 refresh is bounded, and 429 Retry-After suspends subsequent requests. A real Premium-account spike remains required to validate API access and repeat behavior. This repository does not claim that gate has passed.

## UI tokens

The initial interface uses dark neutral green surfaces, pale green primary actions, separate red rejection text and visible status copy. Headers use Trebuchet MS; body uses Segoe UI/system fallback, without third-party font requests. Tokens are centralized in `src/style.css`. Native dialog focus handling, labeled forms, visible keyboard focus and button equivalents support keyboard use. No custom brand identity or generated artwork is introduced.
