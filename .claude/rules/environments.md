<!-- rule-version: 1.0 -->
# Environments

## Environment Types

Closed list — every project starts with dev + prod, others added as needed:

| Type | What it is | Data | Build mode default |
|---|---|---|---|
| **dev** | Local machine | Local/mock | debug |
| **preview** | Per-feature/PR, temporary | Seed/test data | debug |
| **test** | Shared test environment | Test data | release |
| **pre-prod** | Mirror of production | Anonymized prod data | release |
| **prod** | Production (sacred) | Real data | release (always) |

**Prod is sacred:** always release build, always production config, no exceptions.

## Config Convention

One `.env` file per environment, completely self-contained (no inheritance):

```
.env.local          → dev (always gitignored)
.env.preview        → preview
.env.test           → test
.env.preprod        → pre-prod
.env.production     → prod
```

Full isolation per environment: separate SaaS accounts, databases, credentials.

**Secrets:**
- dev / preview / test — secrets in `.env` files are fine (gitignored).
- pre-prod / prod — secrets never in files. Injected via CI, deployment platform, or vault.

## Environment and Build Mode

Environment (config) and build mode (debug/release) are separate dimensions. Environment determines what the app connects to. Build mode determines how it's compiled. Prod is always release. Others default as shown above but can be overridden (e.g., debug build on test for troubleshooting).
