# AtomicGroup Recruitment Intelligence

Electron desktop app for recruiter-facing candidate assessment and hiring-manager briefing generation.

## Local Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Run fast unit tests:

```bash
npm run test:unit
```

## Local Windows Packaging

Build a Windows NSIS installer locally:

```bash
npm run dist
```

Output files are written to `dist/`.

## GitHub Release Workflow

Windows installer publishing is tag-based.

- Ordinary branch pushes do not publish installers.
- Pushing a version tag like `v1.0.0` triggers the GitHub Actions release workflow.
- The workflow builds a Windows `.exe` installer and uploads it to the matching GitHub Release.
- A manual `workflow_dispatch` path is also available for a specific release tag.

Release the current version:

```bash
git push origin main
git tag v1.0.0
git push origin v1.0.0
```

Important:

- The release tag must match the version in `package.json`.
- Example: package version `1.0.0` must be released with tag `v1.0.0`.

## GitHub Secrets

The workflow uses the built-in `GITHUB_TOKEN` to create releases and upload assets.

Optional Windows signing secrets:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

If those secrets are not configured, the workflow still builds an unsigned Windows installer.

The workflow maps those secrets to the environment variables expected by `electron-builder`:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

## Notes

- The packaged app bundles the Electron runtime, app code, and built-in templates.
- Hiring-manager Word templates remain user-configured at runtime and are stored in the app's local user-data directory.
