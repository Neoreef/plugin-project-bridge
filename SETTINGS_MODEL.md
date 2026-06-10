# Project Bridge — Settings & Credentials Model

This document defines the **single source of truth** for Project Bridge configuration,
resolving the manifest-vs-per-service split flagged in NEO-89.

## TL;DR

| Setting | Source of truth | Where it lives | Set by |
| --- | --- | --- | --- |
| OAuth **credentials** (`clientId`, `clientSecret`, `callbackUrl`, `dataCenter`) | **Per-service plugin state** | `bridge.service.{serviceId}.config` | Settings UI → `save-service-oauth-config` action / OAuth callback |
| OAuth **tokens** (`refreshToken`, `accessToken`, `expiresAt`, `dataCenter`) | **Per-service plugin state** | `bridge.service.{serviceId}.auth` | OAuth callback / token refresh |
| Feature toggles (`projectsEnabled`, `deskEnabled`, `crmEnabled`) | **Manifest instance config** | `ctx.config.get()` | Instance settings |
| Projects **portal** (`portalId`) / Desk org (`deskOrgId`) | **Manifest instance config** | `ctx.config.get()` | Instance settings |

There is exactly **one** location for each setting. The manifest no longer
declares any credential fields, so it can never disagree with per-service state.

## Why per-service state owns credentials

The settings UI and the OAuth flow are inherently **per-service**: a deployment
can connect multiple Zoho services (Projects, Desk, CRM), each with its own
Zoho API Console client and data center. A single top-level
`zohoClientId`/`zohoClientSecret` in the manifest cannot represent that, and
when the two models disagreed, `zoho-client.ts` read stale/empty manifest
credentials and **silently broke token refresh**.

Per-service state (`bridge.service.{id}.config`) is therefore the single source
of truth for credentials. `src/lib/zoho-client.ts` reads credentials only from
per-service state (`getOAuthCredentials`); it never reads the manifest config.

### Removed manifest fields (NEO-89)

The following fields were **removed** from `instanceConfigSchema` in
`src/manifest.ts` because per-service state is now authoritative:

- `zohoClientId`
- `zohoClientSecret`
- `dataCenter` (the active data center is carried on each service's auth state)
- `oauthCallbackUrl` (now per-service `callbackUrl`)

Existing instances that had these set are unaffected: the values become inert
because no code reads them anymore.

## Token refresh resolution order

`refreshAccessToken` (in `src/lib/zoho-client.ts`) resolves credentials as
follows, so token refresh works **regardless of any manifest top-level config**:

1. Resolve the active auth via `getAuth`, which returns the auth state and the
   `serviceId` it belongs to (or `null` for the legacy global `zoho.auth` slot).
2. Look up credentials with `getOAuthCredentials(serviceId)`:
   - If a `serviceId` is known, read `bridge.service.{serviceId}.config`.
   - For the legacy global slot (no `serviceId`), fall back to the first
     service that has credentials configured.
   - If none are configured, throw a clear, actionable error.
3. Refreshed tokens are written back to the **same slot** they were read from
   (per-service or global), keeping each service's tokens isolated.

## Legacy / backwards compatibility

The global `zoho.auth` state key (seeded via the `seed-auth` action) is still
honoured as a fallback for pre-per-service installs. New connections always use
the per-service model.
