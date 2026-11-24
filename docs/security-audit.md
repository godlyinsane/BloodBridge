# BloodBridge dependency security review

This project uses GitHub Actions to audit the frontend and backend dependency trees.

## Remediation performed

- Applied npm's non-forced security fixes and refreshed the lockfiles.
- Upgraded the backend upload middleware from Multer 1.x to Multer 2.x.
- The remediation workflow runs frontend tests/build and backend tests/syntax checks before committing dependency changes.
- On the latest audited commit, npm audit reported zero critical, high, moderate, or low vulnerabilities in the deployment-root, frontend, and backend dependency trees. Repeat the audit regularly because advisories change.

## Important remaining review item

The frontend build has been migrated from Create React App to Vite and Vitest. Vitest was upgraded to a patched release after npm reported critical advisories. The root deployment dependency `@vercel/blob` is pinned to the npm-audit-recommended patched release because the registry audit marked later releases in the dependency tree as vulnerable; verify the advisory database before changing that pin.

## Re-run

The workflow `.github/workflows/dependency-audit.yml` audits the deployment root and both package directories, and uploads raw JSON reports as workflow artifacts. The workflow `.github/workflows/security-remediation.yml` applies non-forced updates and runs the build/tests before committing dependency changes.

A passing build alone is not evidence that all dependency vulnerabilities are resolved. Check the audit report and rerun the frontend build and backend tests after any toolchain migration.
