# examples — Deepgram Code Examples

> **This app is part of the Deepgram DX stack.** When working in this repo, you must follow cross-stack documentation rules.

## DX Stack Rules

1. **Incremental changes, comprehensive reviews.** Make changes incrementally. But before finishing any task, do a comprehensive review to spot architectural misses — port conflicts, auth flow breakage, env var mismatches, or contract changes that affect other services.

2. **Update dx-stack docs when you change cross-stack behavior.** If your change affects ports, auth flows, env vars, redirect URIs, API contracts, or deployment config, update the reference docs in your local checkout of https://github.com/deepgram/dx-stack before finishing.

3. **Know the architecture.** Read `AGENTS.md` and `docs/architecture.md` in your `dx-stack` checkout for the full stack context — port map, auth flows, service-to-service communication, and environment matrix.

### What requires dx-stack updates

| Change | Update |
|--------|--------|
| Port changes | `dx-stack/AGENTS.md` port map + `dx-stack/data/ports.yaml` + `dx-stack/docs/runbook.md` |
| Auth flow / session changes | `dx-stack/docs/auth.md` |
| OIDC client changes | `dx-stack/data/oidc-clients.yaml` + `dx-stack/docs/auth.md` client table |
| Env var changes | `dx-stack/data/env-vars.yaml` + `dx-stack/docs/environments.md` |
| New cross-service endpoints | `dx-stack/AGENTS.md` cross-service section |
| Deployment / Fly config changes | `dx-stack/AGENTS.md` deployment section |
| Database schema changes | `dx-stack/docs/auth.md` schema section |
| Redirect URI changes | `dx-stack/data/oidc-clients.yaml` + `dx-stack/docs/auth.md` + seed.ts |

Code examples demonstrating Deepgram API usage across languages.
