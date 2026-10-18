// 本番Worker「seo-pages」本体。
// RankCraft フェーズ1(AFF/カジノ・マスターデータ)。
//
// 役割:
//   - /r/<slug>        : カジノの収益化リンクへ302転送しつつクリックを記録
//   - /admin/casinos    : カジノ一覧・更新API(共有トークンのみで保護)
//   - それ以外          : 通常どおり静的ファイル(HTML/CSS/画像など)をそのまま返す
//
// 静的ファイルは env.ASSETS にフォールバックするだけで、このWorkerのコードは
// /r/ と /admin/ 以外のリクエストには一切介入しない(今までの配信内容を変えない)。

export interface Env {
  ASSETS: Fetcher;
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

const FALLBACK = "/casino-list.html";
const VALID_STATUS = new Set(["active", "pending", "test"]);

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function recordClick(db: D1Database, casinoId: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO clicks (casino_id, date, count)
       VALUES (?1, ?2, 1)
       ON CONFLICT(casino_id, date) DO UPDATE SET count = count + 1`
    )
    .bind(casinoId, todayUTC())
    .run();
}

async function handleRedirect(request: Request, env: Env, ctx: ExecutionContext, rawSlug: string): Promise<Response> {
  const base = request.url;
  const slug = decodeURIComponent(rawSlug);

  if (!slug || slug.includes("/")) {
    return Response.redirect(new URL(FALLBACK, base).toString(), 302);
  }

  const row = await env.CASINO_DB.prepare(
    `SELECT id, affiliate_url, fallback_path, status FROM casinos WHERE slug = ?1`
  )
    .bind(slug)
    .first<Pick<CasinoRow, "id" | "affiliate_url" | "fallback_path" | "status">>();

  if (!row) {
    return Response.redirect(new URL(FALLBACK, base).toString(), 302);
  }

  const hasValidLink = (row.status === "active" || row.status === "test") && row.affiliate_url && isValidHttpsUrl(row.affiliate_url);

  if (!hasValidLink) {
    return Response.redirect(new URL(row.fallback_path, base).toString(), 302);
  }

  ctx.waitUntil(
    recordClick(env.CASINO_DB, row.id).catch(() => {
      /* 記録失敗はリダイレクト自体の成否に影響させない */
    })
  );

  return Response.redirect(row.affiliate_url as string, 302);
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const len = Math.max(a.length, b.length, 1);
  const bufA = new Uint8Array(len);
  const bufB = new Uint8Array(len);
  bufA.set(encoder.encode(a));
  bufB.set(encoder.encode(b));
  return a.length === b.length && crypto.subtle.timingSafeEqual(bufA, bufB);
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.RANKCRAFT_ADMIN_TOKEN) return false;
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/);
  return !!match && constantTimeEqual(match[1], env.RANKCRAFT_ADMIN_TOKEN);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleAdminGet(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return json({ error: "unauthorized" }, 401);
  const { results } = await env.CASINO_DB.prepare(
    `SELECT id, slug, name, affiliate_url, fallback_path, status, estimated_rate, updated_at
     FROM casinos ORDER BY name`
  ).all<CasinoRow>();
  return json({ casinos: results });
}

async function handleAdminPost(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const fallbackPath = typeof body.fallback_path === "string" ? body.fallback_path.trim() : "";
  const status = typeof body.status === "string" ? body.status : "pending";
  const estimatedRate = typeof body.estimated_rate === "number" ? body.estimated_rate : null;
  const affiliateUrlRaw = body.affiliate_url;

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return json({ error: "invalid_slug" }, 400);
  if (!name) return json({ error: "invalid_name" }, 400);
  if (!fallbackPath.startsWith("/")) return json({ error: "invalid_fallback_path" }, 400);
  if (!VALID_STATUS.has(status)) return json({ error: "invalid_status" }, 400);

  let affiliateUrl: string | null = null;
  if (typeof affiliateUrlRaw === "string" && affiliateUrlRaw.trim() !== "") {
    if (!isValidHttpsUrl(affiliateUrlRaw.trim())) return json({ error: "invalid_affiliate_url" }, 400);
    affiliateUrl = affiliateUrlRaw.trim();
  }

  await env.CASINO_DB.prepare(
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
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/r/")) {
      return handleRedirect(request, env, ctx, url.pathname.slice(3));
    }

    if (url.pathname === "/admin/casinos") {
      if (request.method === "GET") return handleAdminGet(request, env);
      if (request.method === "POST") return handleAdminPost(request, env);
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST" } });
    }

    return env.ASSETS.fetch(request);
  },
};
