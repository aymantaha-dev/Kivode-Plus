# Contributing to Kivode+ Desktop

Thank you for contributing to Kivode+.

## Repository Governance

This repository is the official **Reference Implementation**.

Kivode+ follows a directory-based ecosystem model:

- New feature development should happen in your own **Independent Fork**.
- You can build, rename, and publish your own version in your own GitHub repository.
- The official maintainers review community projects for **Directory Listing**.
- External feature forks are not merged into the Reference Implementation.

## What Pull Requests Are Accepted Here

Pull requests to this repository should be limited to:

- bug fixes,
- security fixes,
- documentation improvements.

If your change is a product feature or major behavior change, publish it as your own community build instead of opening a feature PR to this repository.

## Recommended Developer Workflow

1. Fork this repository.
2. Create your own version in your fork.
3. Publish it in your own GitHub repository.
4. Submit it to the official directory for review:
   - https://kivode.com/apps/submit

## Local Development Workflow for Accepted PR Types

1. Create a branch from the latest main branch.
2. Install dependencies: `npm install`.
3. Run local development: `npm run dev`.
4. Run checks before committing:
   - `npm run test`
   - `npm run security:check`
   - `npm run verify:baseline`
5. Open a pull request with:
   - a clear summary,
   - security impact statement,
   - test evidence.

## Coding Standards

- Use TypeScript strict-safe patterns.
- Keep security boundaries in the main process.
- Do not bypass filesystem allowlist or command policy.
- Keep comments and docs in English.
- Keep functions focused and single-purpose.

## Pull Request Checklist

- [ ] Scope is limited to bug fix, security fix, or documentation improvement
- [ ] Security invariants preserved
- [ ] No secrets added
- [ ] Tests/checks passed
- [ ] Documentation updated
