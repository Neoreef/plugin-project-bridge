# Project Bridge — Operator Provisioning Runbook (NEO-101)

Turnkey steps to provision the Zoho-side environment that unblocks **NEO-93**
(P1.9 manual verification & v1 sign-off). Every value below was extracted from
the plugin source and verified read-only against the live portal on
**2026-06-12**.

> **Owner:** Werner / NeoReef Zoho admin (`bernesto@neoreef.com`).
> A coding agent cannot perform steps 2–3 (browser-based Zoho API-console
> registration + infrastructure deploy). Steps requiring a human are flagged
> **[HUMAN]**.

---

## 0. Verified environment facts (read-only contract check, 2026-06-12)

Checked via the claude.ai Zoho Projects MCP (production, read-only — **no writes**):

| Fact | Value |
| --- | --- |
| Production portal name | `neoreef` |
| Production portal id | `60418044` |
| Portal owner | Brian Ernesto (`bernesto@neoreef.com`) |
| Data center | **US** (`projects.neoreef.com`, `projectsapi.zoho.com`) |
| Sandbox **portal** exists? | **No** — `get_portals(filter_user_portal=true)` returns only the prod portal |
| Dedicated sandbox **project** exists? | **Yes** — see below |

### Sandbox project (already created by the operator on 2026-06-10)

| Field | Value |
| --- | --- |
| Name | `SANDBOX — Project Bridge Testing` |
| Key | `PR-90` |
| **Project id** | **`853749000006410003`** |
| Project group | `Ungrouped Projects` (id `853749000000221001`) |
| Description | "Dedicated sandbox project for Project Bridge plugin integration testing. DO NOT use for real work." |

---

## 1. Sandbox environment — REFRAMED (effectively satisfied)

**Zoho Projects has no native "sandbox portal" feature** (unlike Zoho CRM). The
NEO-101 ask for "a non-production portal" is not directly fulfillable on this
Zoho One plan without standing up a *separate Zoho org*. The plugin was built
with this reality in mind: the manifest `allowedProjectIds` allowlist exists
specifically to **"bound writes to a dedicated test project when running against
a live/production portal"** (`src/manifest.ts:77-82`,
`src/modules/sync/projects-handler.ts:396-408`).

The operator already created the dedicated test project `PR-90` above. So the
safe-isolation requirement is met **by configuration**, not by a separate
portal:

- `portalId = 60418044`
- `allowedProjectIds = 853749000006410003`

With the allowlist set, inbound webhooks for **any other project are ignored**,
so real production tasks can never be mirrored or mutated. This is the
recommended v1 posture. **No further human action needed for deliverable #1**
beyond setting the two config values in step 4.

> Optional stricter alternative **[HUMAN]**: create a brand-new free Zoho
> account → new Projects portal → use that portal id instead. Only do this if a
> reviewer insists on a physically separate portal; it is not required given the
> allowlist guarantee.

---

## 2. Plugin OAuth client **[HUMAN]**

Register the Project Bridge plugin's *own* OAuth client (separate from the
claude.ai MCP connection) at the Zoho API console for the **US** DC:
<https://api-console.zoho.com/>.

1. Create a **Server-based Application**.
2. **Authorized redirect URI** — must exactly equal the deployed plugin's OAuth
   callback URL (the `oauth-callback` webhook endpoint, `src/manifest.ts:108-112`).
   It is stored per-service as `callbackUrl` and sent verbatim as `redirect_uri`
   (`src/worker.ts:266`). Fill in once step 3 fixes the deploy URL, e.g.
   `https://<deployed-plugin-host>/webhooks/project-bridge/oauth-callback`.
3. Copy the generated **Client ID** and **Client Secret**.

> **Received 2026-06-12 (Werner):** Client ID `1000.DQF76AHIV90K2IWXCWUQ4FN6W1Y08A`
> (US DC `1000.` prefix — consistent with `dataCenter = US`). A client_id is a
> public value (it travels in the browser authorize URL), so it is recorded here.
> **Still outstanding for this deliverable:**
> - **Client Secret** — sensitive. Do **NOT** paste it into an issue comment or
>   commit it; enter it directly in the deployed plugin's settings UI
>   (`bridge.service.{id}.config.clientSecret`, NEO-89). Without it,
>   `getOAuthCredentials` throws and token refresh cannot run
>   (`src/lib/zoho-client.ts:82-101,112-120`).
> - **Authorized redirect URI** — cannot be registered against this client until
>   the deploy host (step 3) is known; it must byte-match the plugin `callbackUrl`.

### Exact OAuth parameters the plugin uses (do not guess — from source)

- **Authorize endpoint:** `https://accounts.zoho.com/oauth/v2/auth`
- **Token endpoint:** `https://accounts.zoho.com/oauth/v2/token`
- **Connect params** (`src/worker.ts:261-270`): `response_type=code`,
  `access_type=offline`, `prompt=consent`, `state={serviceId,pluginId}`.
  `access_type=offline` + `prompt=consent` are what yield a **refresh token**.
- **Scopes** (`src/constants.ts:34-48`) — Projects-only are required for v1
  (Desk/CRM are disabled by default in the manifest):
  ```
  ZohoProjects.tasks.ALL,ZohoProjects.portals.READ,ZohoProjects.projects.ALL,ZohoProjects.users.READ,ZohoProjects.clients.READ
  ```
  (The plugin also requests Desk/CRM scopes; granting them is harmless but not
  needed while only Projects sync is enabled.)

Credentials are **not** stored in the manifest — they go into per-service plugin
state (`bridge.service.{id}.config`) via the settings UI (NEO-89). Enter them in
step 4.

---

## 3. Deployed plugin instance + webhook **[HUMAN / OPS]**

1. Deploy a running Project Bridge instance reachable by Zoho over HTTPS.
2. Note its public base URL → use it for the redirect URI in step 2.
3. **Configure a webhook shared secret** so inbound webhooks are authenticated
   (`src/modules/sync/webhook-auth.ts`). Posture: if **no** secret is configured
   anywhere the endpoint **fails OPEN** (logs a warning); configuring a secret
   switches it to **ENFORCED** (rejects unauthenticated calls). Set it either as
   the instance-level `webhookSecret` config or per-service.
4. In the Zoho Projects **workflow webhook** (Deluge) that fires on task
   create/update, present the secret one of these ways
   (`webhook-auth.ts:30-47`):
   - Header (preferred): `X-Bridge-Webhook-Secret: <secret>`
     (also accepted: `X-Webhook-Secret`, `X-Webhook-Token`, `X-Zoho-Webhook-Token`)
   - or a body/form field: `webhookSecret` / `secret` / `token` / …
   - or an HMAC-SHA256 of the raw body in `X-Bridge-Signature: sha256=<hexdigest>`
     (also accepted: `X-Webhook-Signature`, `X-Zoho-Signature`, `X-Signature`).

---

## 4. Plugin instance configuration (after steps 2–3)

Set in plugin settings (manifest `instanceConfigSchema`, `src/manifest.ts:55-88`):

| Setting | Value |
| --- | --- |
| `projectsEnabled` | `true` |
| `deskEnabled` / `crmEnabled` | `false` |
| `portalId` | `60418044` |
| `allowedProjectIds` | `853749000006410003` |
| `webhookSecret` (instance) | the secret from step 3 |

Per-service OAuth config (settings UI → service connection):
`clientId` (= `1000.DQF76AHIV90K2IWXCWUQ4FN6W1Y08A`, received 2026-06-12),
`clientSecret`, `callbackUrl` (= redirect URI), `dataCenter = US`.
Then click **Connect** to run OAuth and obtain the refresh token.

---

## Remaining to unblock NEO-93 (as of 2026-06-12)

Deliverable #1 (sandbox isolation) is satisfied by config (`PR-90` allowlist).
Deliverable #2 is **partially** in: Client ID received. Outstanding operator items —
all require NeoReef Zoho admin / ops and cannot be done from the workspace:

- [ ] **Client Secret** for client `1000.DQF76AHIV90K2IWXCWUQ4FN6W1Y08A` — enter
      directly in the deployed plugin settings UI (do not post in plaintext).
- [ ] **Deployed plugin instance** reachable by Zoho over HTTPS → yields the
      public host for the redirect URI + webhook target (step 3).
- [ ] **Authorized redirect URI** registered on the above client, byte-matching
      the deployed plugin `callbackUrl` (step 2).
- [ ] **Webhook shared secret** configured (instance `webhookSecret` or
      per-service) and presented by the Zoho workflow webhook (step 3).

Owner: **@Werner**. Once all four land, run the §6 P1.9 checklist for v1 sign-off.

---

## 5. Known contract risk to verify during P1.9

The plugin resolves a project's owning company from its **group name**
(`projects-handler.ts:242-322`) by reading `group_name` / `GROUP_NAME` /
`group.name` from the **classic** `/restapi/portal/{portalId}/projects/{id}/`
response. The newer v3 API (used by the MCP) returns the group under
`project_group.name` instead. Two implications:

1. Confirm the classic `restapi` response actually exposes `group_name` for
   `PR-90`; if not, group→company resolution returns null and falls back.
2. `PR-90`'s group is **"Ungrouped Projects"**, which won't match a Paperclip
   company name. For the test, either (a) add an explicit group mapping
   `Ungrouped Projects → <test company>` in settings, or (b) rely on the
   single-company fallback (`projects-handler.ts:273-277`) by running the test
   instance with exactly one company.

---

## 6. After provisioning — run NEO-93 P1.9 checklist

OAuth connect → token refresh → inbound create/update (task in `PR-90` →
Paperclip issue) → outbound status (Paperclip → Zoho task) → webhook auth
rejection of unauthenticated calls → no sync loops. All writes stay inside
`PR-90` via the allowlist.

---

## 7. Inbound webhook — turnkey config & verified findings (NEO-104)

Scope: stand up the **inbound** Zoho→Paperclip path (the only remaining gap for
NEO-93). This is operator/ops + Zoho-portal-browser work that cannot be executed
from a coding-agent workspace; the agent-doable parts (contract verification +
code hardening) are done and noted below.

### 7.1 Verified on 2026-06-12 (agent, read-only)

- **Plugin uses the classic `restapi` base**, not v3 — `getBaseUrl` returns
  `https://projectsapi.zoho.com/restapi` (`src/lib/zoho-client.ts:28`), so the
  group lookup hits `/restapi/portal/{portalId}/projects/{id}/`.
- **Group shape (contract risk #1) — RESOLVED IN CODE.** The live v3 API returns
  PR-90's group as `project_group.name = "Ungrouped Projects"` (confirmed via the
  read-only Projects MCP). The classic `restapi` response shape could not be read
  from the workspace (no token), so `fetchProjectGroupName` now reads **both**
  shapes — `group_name` / `GROUP_NAME` / `group.name` **and** `project_group.name`
  (`projects-handler.ts`, covered by a new test). Group→company resolution now
  survives whichever shape the live classic API returns. **No P1.9 blocker here.**
- **Group→company for PR-90:** group is `Ungrouped Projects`, which won't match a
  Paperclip company name. For the test, either run the instance with **exactly one
  company** (single-company fallback, `projects-handler.ts:273-277`) or add a group
  mapping `Ungrouped Projects → <test company>` in settings.

### 7.2 Deploy host — NO REACHABLE INSTANCE TODAY (probed 2026-06-12, Werner)

Active probing on **2026-06-12** disproves the earlier assumption that
`cortex.neoreef.com:8443` is a working deploy target. There is **no publicly
reachable Project Bridge instance** right now:

| Probe (`POST … {}`) | Result |
| --- | --- |
| `https://cortex.neoreef.com:8443/webhooks/project-bridge/projects` | **connection refused** (port closed) |
| `https://cortex.neoreef.com/webhooks/project-bridge/projects` (:443) | **404** |
| `https://cortex.neoreef.com/api/webhooks/project-bridge/projects` | **404** |
| other company/plugin-scoped path guesses | **404** |

The settings UI default OAuth callback `https://cortex.neoreef.com:8443`
(`src/ui/index.tsx:209`) is **not** live. The plugin must first be installed /
deployed so the platform mounts its webhook endpoints and assigns a public URL.
That devops work is delegated to **@Gene** in **NEO-105** (child of NEO-104).

Once NEO-105 returns the public base URL, still confirm:

1. **Port.** Zoho Projects workflow webhooks should target `:443`; if the host
   only serves a non-standard port, front it with a 443 reverse proxy.
2. **Callback path mismatch.** UI default path is `/oauth/callback`, but the
   manifest endpoint is `/webhooks/project-bridge/oauth-callback` (`src/manifest.ts:108-112`).
   Whatever the reverse proxy serves, the **inbound projects webhook** lives at
   the manifest path below — verify it is reachable.

### 7.3 Exact Zoho workflow-webhook configuration

Inbound endpoint (path is fixed by the manifest `projects` webhook key):

```
POST https://<deployed-host>/webhooks/project-bridge/projects
```

In portal `neoreef` (`60418044`) → Project `PR-90` → **Workflow Rules / Webhooks**,
on Task **create** and **update**:

- **Method:** `POST`
- **URL:** the URL above
- **Auth header (preferred):** `X-Bridge-Webhook-Secret: <SECRET>`
  (also accepted: `X-Webhook-Secret`, `X-Webhook-Token`, `X-Zoho-Webhook-Token`;
  or an HMAC over the raw body in `X-Bridge-Signature: sha256=<hex>`)
  — header list authoritative in `src/modules/sync/webhook-auth.ts:30-47`.
- **Body:** the task payload (the handler normalizes Zoho task fields → id, name,
  status, priority, project id; `normalizeProjectsPayload`).

### 7.4 The shared secret

Generate a strong secret (do **NOT** commit it or paste it in an issue comment):

```bash
openssl rand -hex 32
```

Set the **same** value in two places so auth runs ENFORCED (not fail-open):
1. Deployed instance setting `webhookSecret` (instance config) or per-service.
2. The Zoho webhook header `X-Bridge-Webhook-Secret`.

### 7.5 Remaining work — owners & sequencing (updated 2026-06-12)

Ordered; each step unblocks the next.

1. [ ] **Deploy + publicly expose the instance** and report the public webhook URL
       (§7.2). Owner: **@Gene (devops)** → tracked in **NEO-105** (blocks NEO-104).
2. [ ] **Set `webhookSecret`** (§7.4) once the instance is up. Owner: **@Werner**.
3. [ ] **Configure the Zoho `PR-90` workflow webhook** (§7.3) to POST to the URL
       with `X-Bridge-Webhook-Secret`. Owner: **@Werner**, exhausting the Zoho
       Projects API / plugin-OAuth path first (the plugin client holds
       `ZohoProjects.projects.ALL`); a human portal admin is the fallback **only**
       if Zoho exposes no programmatic webhook-config path.
4. [ ] **End-to-end test**: create/update a task in `PR-90` → endpoint → auth →
       mapped Paperclip issue. Then NEO-93 auto-resumes for §6 sign-off.
