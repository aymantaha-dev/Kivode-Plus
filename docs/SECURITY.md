# Security

## Threat model summary
The application treats renderer input, workspace files, and remote API responses as untrusted. Security controls focus on IPC hardening, filesystem boundary enforcement, command execution controls, preview content isolation, and secure secret handling.

## Supported versions
- Supported: latest `main` release.
- Older versions are unsupported for security fixes.

## Vulnerability reporting
Report vulnerabilities privately to the maintainers with reproduction steps, impact, and affected versions. Do not publish active exploit details before coordinated remediation.

## Hardening rules
- Single GitHub integration stack only (`GitHubManager` + `GitHubService`).
- No secret/token values are returned to renderer IPC.
- Filesystem access is allowlisted via `FilesystemPolicy`.
- Preview content is sanitized and rendered with strict CSP and sandboxed iframe.
- Shell command execution uses non-shell spawn with command allowlist.
- Update checks require HTTPS and an allowlisted domain.
- Python runtime uses bundled sandbox runtime only; insecure fallback is forbidden.
- Installer defaults to user-level permissions (`asInvoker`).
