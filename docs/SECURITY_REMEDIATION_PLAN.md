# Security Remediation Plan

## Phase 0
- Audit report source was unavailable in repository (`docs/SECURITY_AUDIT_REPORT.md` missing), so remediation executed against the explicit finding set F-01..F-10 from the task request.

### Baseline verification
- Command run: `bash scripts/verify-baseline.sh`
- Result: PASS after hardening updates. Lint is skipped in-script when ESLint config is missing; build and security checks pass.

## Findings Checklist
- [x] **F-01 Legacy GitHub publish code with shell/token exposure**
  - Severity: Critical
  - Affected: `src/main/services/github-publish.service.ts`, `src/main/ipc/github-handlers.ts`, GitHub IPC handlers
  - Planned fix: Remove legacy stack; keep only `GitHubManager` + `GitHubService`; enforce secret redaction/non-exposure.
  - Verification: security checks script + grep for removed files.

- [x] **F-02 Overly permissive filesystem policy**
  - Severity: Critical
  - Affected: `src/main/main.ts`, `src/main/services/FileManager.ts`
  - Planned fix: Centralized allowlist policy in `src/main/security/filesystem-policy.ts` and route all file ops through it.
  - Verification: policy checks in `scripts/security-checks.mjs` and build/lint.

- [x] **F-03 Active-content preview execution risk**
  - Severity: Critical
  - Affected: `src/renderer/src/components/PreviewPanel.tsx`
  - Planned fix: sanitize preview HTML, remove script injection, strict iframe sandbox, strict CSP meta.
  - Verification: sanitizer invariants in `scripts/security-checks.mjs`.

- [x] **F-04 Secret exposure via store IPC**
  - Severity: Critical
  - Affected: `src/main/main.ts`, `src/renderer/src/components/SettingsPanel.tsx`
  - Planned fix: `store:getApiKey` returns null; `store:getAll` redacts keys; renderer no longer fetches raw keys.
  - Verification: IPC checks via static security checks + manual code inspection.

- [x] **F-05 Hardcoded encryption key**
  - Severity: High
  - Affected: `src/main/services/GitHubService.ts`
  - Planned fix: per-user generated key file in `userData`, legacy migration path from old static key.
  - Verification: security checks assertion for random key generation + build.

- [x] **F-06 Update URL trust / update mechanism hardening**
  - Severity: High
  - Affected: `src/main/main.ts`, `src/main/security/update-policy.ts`
  - Planned fix: enforce HTTPS + pinned domain allowlist.
  - Verification: security checks + lint/build.

- [x] **F-07 Python fallback insecurity / inconsistent sandbox posture**
  - Severity: High
  - Affected: `src/main/services/SandboxService.ts`
  - Planned fix: retain single bundled-runtime strategy; no system Python fallback.
  - Verification: baseline build + architecture/security docs.

- [x] **F-08 Shell command runner risk**
  - Severity: High
  - Affected: `src/main/services/TaskEngineService.ts`, `src/main/security/command-policy.ts`
  - Planned fix: parse+allowlist commands, `spawn` with `shell: false`, timeout and output limits.
  - Verification: security checks for no `shell:true` + build.

- [x] **F-09 Installer privilege level / elevated defaults**
  - Severity: Medium
  - Affected: `package.json`, `electron-builder.config.js`
  - Planned fix: `requestedExecutionLevel` changed to `asInvoker` and admin warning text updated.
  - Verification: config checks in script.

- [x] **F-10 Integration drift and contract mismatches**
  - Severity: Medium
  - Affected: security policy modules + IPC/store/publish flows
  - Planned fix: single GitHub stack, central FS/update/command policy modules, security contract checks.
  - Verification: `scripts/security-checks.mjs` invariants.

## Final verification evidence
- `npm run lint` (fails in this environment because no ESLint config file exists)
- `npm run build` (pass)
- `npm run security:check` (pass)
- `npm test` (pass; executes security checks)
- `bash scripts/verify-baseline.sh` (pass; includes install/build/security checks with conditional lint)

## Residual risks
- Full cryptographic signature verification for update payloads is not yet implemented because the current feed only provides metadata URL checks.
- Runtime policy contract tests are implemented as static invariant checks and should be expanded to runtime integration tests in future iterations.
