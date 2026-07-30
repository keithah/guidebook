# GitHub Pages HERE Secret Design

## Goal

Enable HERE Discover and Public Transit in the production GitHub Pages build without exposing the configured browser API key in source, logs, artifacts beyond the unavoidable Vite client bundle, or review comments.

## Selected approach

Use the existing `VITE_HERE_API_KEY` value from the ignored local `app/.env` as a repository-level GitHub Actions secret with the same name. Add that secret to the build step in `.github/workflows/deploy-guidebook.yml`, alongside the existing 511 secret.

Repository-level scope is appropriate because this repository has one Pages deployment workflow. An environment-scoped secret would add configuration without changing which build receives the value, while committing an environment file or literal value would expose the credential.

## Data flow

1. Read `VITE_HERE_API_KEY` from `app/.env` without echoing it.
2. Pipe the value to `gh secret set VITE_HERE_API_KEY` for `keithah/guidebook`.
3. During the Pages build, GitHub injects the secret as `VITE_HERE_API_KEY` only for `npm run build`.
4. Vite supplies the value to the existing HERE search and transit modules through `import.meta.env.VITE_HERE_API_KEY`.

## Safety and failure handling

- Never print, interpolate into command output, commit, or include the key in tests.
- Confirm the local value is non-empty before setting the secret.
- Verify only GitHub secret metadata (name and update time), never its value.
- Keep `.env` ignored and untracked.
- If the secret write fails, do not publish the workflow change.

## Delivery and verification

Commit the workflow-only change on `fix/deploy-here-secret`, open and merge a focused pull request, and monitor the Pages workflow triggered by the merge. Success requires the build and deploy jobs to pass at the merge commit and the Pages URL to remain available.

