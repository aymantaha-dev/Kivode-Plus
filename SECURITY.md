# Security Policy

## Supported Versions

Security support is provided for the latest `main` branch release.

## Reporting a Vulnerability

Please report vulnerabilities privately and include:
- affected version/commit,
- reproduction steps,
- expected vs actual behavior,
- potential impact.

Do not publicly disclose exploitable details before a fix is available.

## Security Baseline

Kivode+ Desktop enforces:
- strict IPC boundary control,
- filesystem allowlist policy,
- command execution policy and argument validation,
- renderer-safe redaction and secret protection,
- sanitized preview rendering,
- hardened update URL validation.

Run local security checks:

```bash
npm run security:check
npm run verify:baseline
```
