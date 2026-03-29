# Developer Guide

## Commit Message Standard

Use Conventional Commits so versioning and release automation work correctly.

- `feat: ...` -> minor version bump
- `fix: ...` -> patch version bump
- `feat!: ...` or `BREAKING CHANGE:` -> major version bump
- `chore: ...` -> CI build runs, npm release is skipped

Examples:

```text
feat: add backend timeout support
fix: handle client disconnect race
feat!: remove legacy response format
chore: update docs
```

## Skip GitHub Actions

To skip GitHub Actions for a commit, add one of these tokens to the commit message:

- `[skip ci]`
- `[ci skip]`
- `[no ci]`
- `[skip actions]`
- `[actions skip]`

Example:

```text
chore: update docs [skip ci]
```

## Release Process

This repository uses semantic-release from GitHub Actions.

Node runtime requirement for release tooling:

- Use Node 22 or newer for CI and local release commands.
- semantic-release requires Node `^22.14.0 || >=24.10.0`.

- CI runs on pushes to `main` and pull requests to `main`.
- Release runs only on pushes to `main`.
- Release is skipped for commits that start with `chore:`.
- semantic-release calculates the next version from commit messages.
- semantic-release publishes to npm and creates the GitHub release.

## Required GitHub Secrets

Add these repository secrets:

- `NPM_TOKEN`: npm access token with publish permission
- `GITHUB_TOKEN`: provided automatically by GitHub Actions

## Local Commands

```bash
npm run build
npm run release
```

Use `npm run release` for local dry/debug workflows only if needed. The normal release path is GitHub Actions on push to `main`.
