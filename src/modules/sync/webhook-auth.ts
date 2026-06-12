/**
 * Inbound webhook authentication for Zoho webhooks.
 *
 * Inbound webhooks (zoho-projects, zoho-desk) create/mutate Paperclip issues,
 * so they must be authenticated before any handler runs. Zoho workflow webhooks
 * cannot do real OAuth on the callback, but they CAN attach a configurable
 * shared secret (custom header / URL or body parameter) and can be configured to
 * send an HMAC signature of the payload. We accept either:
 *
 *   1. Shared-secret token — a configured secret presented verbatim via a
 *      header (e.g. `X-Webhook-Secret`) or a body/form field (`webhookSecret`,
 *      `secret`, `token`, …). Compared in constant time.
 *   2. HMAC-SHA256 signature — `X-Webhook-Signature: [sha256=]<hexdigest>` where
 *      the digest is HMAC-SHA256(rawBody, secret). Compared in constant time.
 *
 * The secret is configurable per service (OAuth config) and/or globally via the
 * instance `webhookSecret` config — never hard-coded.
 *
 * Posture:
 *   - If at least one secret is configured, verification is ENFORCED: requests
 *     without a valid token/signature are rejected.
 *   - If no secret is configured anywhere, we fail OPEN with a loud warning so a
 *     freshly deployed integration keeps syncing — operators should configure a
 *     secret to close the endpoint.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { PluginContext, PluginWebhookInput } from "@paperclipai/plugin-sdk";

/** Header names (lower-cased) that may carry a plain shared-secret token. */
const TOKEN_HEADERS = [
  "x-bridge-webhook-secret",
  "x-webhook-secret",
  "x-webhook-token",
  "x-zoho-webhook-token",
];

/** Header names (lower-cased) that may carry an HMAC-SHA256 signature. */
const SIGNATURE_HEADERS = [
  "x-bridge-signature",
  "x-webhook-signature",
  "x-zoho-signature",
  "x-signature",
];

/** Body/query field names that may carry a plain shared-secret token. */
const TOKEN_FIELDS = ["webhookSecret", "webhook_secret", "webhookToken", "webhook_token", "secret", "token"];

export type WebhookAuthResult = {
  ok: boolean;
  /** How the request authenticated (when ok) or why it failed (when not). */
  reason: string;
  /** "token" | "hmac" | "unconfigured" — for logging. */
  method?: string;
};

/** Build a case-insensitive view of the inbound headers. */
function lowerHeaders(headers: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    out[k.toLowerCase()] = Array.isArray(v) ? v[0] ?? "" : v;
  }
  return out;
}

/** Constant-time string compare that does not leak length via early return. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws if lengths differ; hash to a fixed width first so the
  // comparison itself is constant-time regardless of input lengths.
  const ha = createHmac("sha256", "len-guard").update(bufA).digest();
  const hb = createHmac("sha256", "len-guard").update(bufB).digest();
  return timingSafeEqual(ha, hb);
}

/** Extract candidate plain tokens presented by the request (headers + body). */
function extractPresentedTokens(input: PluginWebhookInput, headers: Record<string, string>): string[] {
  const tokens: string[] = [];

  for (const h of TOKEN_HEADERS) {
    const val = headers[h];
    if (val) tokens.push(val.trim());
  }

  // Body fields — from parsed JSON body…
  const body = input.parsedBody;
  if (body && typeof body === "object") {
    for (const f of TOKEN_FIELDS) {
      const val = (body as Record<string, unknown>)[f];
      if (typeof val === "string" && val) tokens.push(val.trim());
    }
  }

  // …and from a raw form-encoded / JSON body (Zoho Deluge can append a field).
  const raw = input.rawBody ?? "";
  if (raw) {
    try {
      const params = new URLSearchParams(raw);
      for (const f of TOKEN_FIELDS) {
        const val = params.get(f);
        if (val) tokens.push(val.trim());
      }
    } catch {
      // not form-encoded — ignore
    }
    if (!body && (raw.startsWith("{") || raw.startsWith("["))) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const f of TOKEN_FIELDS) {
          const val = parsed[f];
          if (typeof val === "string" && val) tokens.push(val.trim());
        }
      } catch {
        // not JSON — ignore
      }
    }
  }

  return tokens;
}

/** Extract HMAC signatures presented by the request, normalized to lower-case hex. */
function extractPresentedSignatures(headers: Record<string, string>): string[] {
  const sigs: string[] = [];
  for (const h of SIGNATURE_HEADERS) {
    const val = headers[h];
    if (val) {
      // Allow "sha256=<hex>" or bare "<hex>".
      const hex = val.includes("=") ? val.split("=").pop()! : val;
      sigs.push(hex.trim().toLowerCase());
    }
  }
  return sigs;
}

/**
 * Collect every configured secret that may authenticate an inbound webhook:
 * the global instance `webhookSecret` plus each registered service's secret.
 */
async function collectConfiguredSecrets(ctx: PluginContext): Promise<string[]> {
  const secrets = new Set<string>();

  try {
    const config = (await ctx.config.get()) as { webhookSecret?: string };
    if (config.webhookSecret) secrets.add(config.webhookSecret.trim());
  } catch {
    // config unavailable — ignore
  }

  try {
    const services = ((await ctx.state.get({ scopeKind: "instance", stateKey: "bridge.services" })) as Array<{ id: string }> | null) ?? [];
    for (const svc of services) {
      const oauthConfig = (await ctx.state.get({ scopeKind: "instance", stateKey: `bridge.service.${svc.id}.config` })) as { webhookSecret?: string } | null;
      if (oauthConfig?.webhookSecret) secrets.add(oauthConfig.webhookSecret.trim());
    }
  } catch {
    // state unavailable — ignore
  }

  return [...secrets].filter(Boolean);
}

/**
 * Verify an inbound webhook request against the configured shared secret(s).
 * Returns `{ ok: true }` when authenticated (or when no secret is configured —
 * fail-open with a warning logged by the caller).
 */
export async function verifyWebhookAuth(
  ctx: PluginContext,
  input: PluginWebhookInput,
): Promise<WebhookAuthResult> {
  const secrets = await collectConfiguredSecrets(ctx);

  if (secrets.length === 0) {
    return { ok: true, method: "unconfigured", reason: "no webhook secret configured" };
  }

  const headers = lowerHeaders(input.headers);

  // 1. Plain shared-secret token.
  const presentedTokens = extractPresentedTokens(input, headers);
  for (const token of presentedTokens) {
    for (const secret of secrets) {
      if (safeEqual(token, secret)) {
        return { ok: true, method: "token", reason: "valid shared-secret token" };
      }
    }
  }

  // 2. HMAC-SHA256 signature of the raw body.
  const presentedSigs = extractPresentedSignatures(headers);
  if (presentedSigs.length > 0) {
    const raw = input.rawBody ?? "";
    for (const secret of secrets) {
      const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
      for (const sig of presentedSigs) {
        if (safeEqual(sig, expected)) {
          return { ok: true, method: "hmac", reason: "valid HMAC signature" };
        }
      }
    }
  }

  const detail =
    presentedTokens.length === 0 && presentedSigs.length === 0
      ? "no token or signature presented"
      : "presented token/signature did not match any configured secret";
  return { ok: false, reason: detail };
}
