# Shared Spotify sign-in configuration

On 2026-10-26, the owner supplied the public Spotify application client ID after requesting the ordinary Spotify sign-in experience. The hosted Music Explorer uses that identifier in browser PKCE authorization requests. Users select Connect with Spotify and grant access on Spotify; no developer identifier is requested in the UI.

The public identifier is owned by src/integrations/spotify/config.ts. It is not a credential, and no client secret is included. Existing minimum playback scopes and token storage are unchanged. The exact production callback is https://nelson-j.ch/music-explorer/. This completes account-independent application configuration; the user still performs Spotify sign-in and consent and must have an eligible account.

The owner previously authorized merge and GitHub Pages publication, now active at the HTTPS URL above. This configuration update is part of that requested setup. Issue #6 owns implementation and verification.
