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
`clientId`, `clientSecret`, `callbackUrl` (= redirect URI), `dataCenter = US`.
Then click **Connect** to run OAuth and obtain the refresh token.

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
