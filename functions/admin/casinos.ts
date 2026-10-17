// /admin/casinos : カジノ・マスターデータの一覧・更新API。
// RankCraft フェーズ1。認証はCloudflare Pagesの環境変数 RANKCRAFT_ADMIN_TOKEN
// と比較する共有トークン1個のみ（ロール分け・Cloudflare Accessは今回のスコープ外）。

interface Env {
  CASINO_DB: D1Database;
  RANKCRAFT_ADMIN_TOKEN: string;
}

interface CasinoRow {
  id: number;
  slug: string;
  name: string;
  affiliate_url: string | null;
  fallback_path: string;
  status: string;
  estimated_rate: number | null;
  updated_at: string;
}

const VALID_STATUS = new Set(["active", "pending", "test"]);

// 固定長に揃えてから比較することで、長さそのものからのタイミング漏洩も避ける。
function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const len = Math.max(a.length, b.length, 1);
  const bufA = new Uint8Array(len);
  const bufB = new Uint8Array(len);
  bufA.set(encoder.encode(a));
  bufB.set(encoder.encode(b));
  const equal = crypto.subtle.timingSafeEqual(bufA, bufB);
  return a.length === b.length && equal;
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.RANKCRAFT_ADMIN_TOKEN) return false;
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) return false;
  return constantTimeEqual(match[1], env.RANKCRAFT_ADMIN_TOKEN);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!isAuthorized(context.request, context.env)) {
    return json({ error: "unauthorized" }, 401);
  }
  const { results } = await context.env.CASINO_DB.prepare(
    `SELECT id, slug, name, affiliate_url, fallback_path, status, estimated_rate, updated_at
     FROM casinos ORDER BY name`
  ).all<CasinoRow>();
  return json({ casinos: results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isAuthorized(context.request, context.env)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const fallbackPath = typeof body.fallback_path === "string" ? body.fallback_path.trim() : "";
  const status = typeof body.status === "string" ? body.status : "pending";
  const affiliateUrlRaw = body.affiliate_url;
  const estimatedRate =
    typeof body.estimated_rate === "number" ? body.estimated_rate : null;

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return json({ error: "invalid_slug" }, 400);
  }
  if (!name) {
    return json({ error: "invalid_name" }, 400);
  }
  if (!fallbackPath.startsWith("/")) {
    return json({ error: "invalid_fallback_path" }, 400);
  }
  if (!VALID_STATUS.has(status)) {
    return json({ error: "invalid_status" }, 400);
  }

  let affiliateUrl: string | null = null;
  if (typeof affiliateUrlRaw === "string" && affiliateUrlRaw.trim() !== "") {
    if (!isValidHttpsUrl(affiliateUrlRaw.trim())) {
      return json({ error: "invalid_affiliate_url" }, 400);
    }
    affiliateUrl = affiliateUrlRaw.trim();
  }

  await context.env.CASINO_DB.prepare(
    `INSERT INTO casinos (slug, name, affiliate_url, fallback_path, status, estimated_rate, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       affiliate_url = excluded.affiliate_url,
       fallback_path = excluded.fallback_path,
       status = excluded.status,
       estimated_rate = excluded.estimated_rate,
       updated_at = datetime('now')`
  )
    .bind(slug, name, affiliateUrl, fallbackPath, status, estimatedRate)
    .run();

  return json({ ok: true, slug });
};
