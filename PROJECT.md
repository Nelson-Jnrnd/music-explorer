# Music Explorer

- Mode: standard
- Product Owner: Nelson Jeanrenaud
- Purpose: explore coherent listening paths from a private local song library, using explicit contextual judgments.
- Approved scope and stack: [functional specification](docs/specifications/Music_Explorer_v1.md), supplied with the implementation request on 2026-10-26.
- First release: browser-only React/TypeScript/Vite application, local persistence, contextual exploration graph and Spotify Connect integration.
- Excluded: backend, ML training, automatic playlists, private data in deployment.
- Voice and visual identity: voice not yet decided; use neutral literal copy. Initial UI uses restrained neutral surfaces with functional green actions and large untouched album art.
- Current phase: published MVP; Spotify account acceptance remains to be verified.
- External dependencies: owner registers a Spotify Developer app and authorizes a Premium account; live playback requires Premium and registered Spotify callbacks. The owner supplied the public application client ID on 2026-10-26 to enable direct sign-in.
- Publication: owner authorized merge and Pages publication on 2026-10-26 and made the repository public. Site: https://nelson-j.ch/music-explorer/. Subsequent authorized setup changes use the manual Pages workflow.
