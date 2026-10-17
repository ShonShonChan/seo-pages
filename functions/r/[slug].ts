// /r/<slug> : カジノの収益化リンクへ302転送しつつ、クリック数を記録する。
// RankCraft フェーズ1（AFF/カジノ・マスターデータ）。D1バインディング名は CASINO_DB。
//
// 挙動:
//   - 該当カジノなし        → /casino-list.html へ302（情報を漏らさない汎用フォールバック）
//   - status!=active または affiliate_url が空 → fallback_path（内部レビューページ）へ302
//   - 有効なカジノ          → クリックを記録してから affiliate_url へ302

interface Env {
  CASINO_DB: D1Database;
}

interface CasinoRow {
  id: number;
  affiliate_url: string | null;
  fallback_path: string;
  status: string;
}

const FALLBACK = "/casino-list.html";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:";
  } catch {
    return false;
  }
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug;
  if (typeof slug !== "string" || slug.length === 0) {
    return Response.redirect(new URL(FALLBACK, context.request.url).toString(), 302);
  }

  const row = await context.env.CASINO_DB.prepare(
    `SELECT id, affiliate_url, fallback_path, status FROM casinos WHERE slug = ?1`
  )
    .bind(slug)
    .first<CasinoRow>();

  const base = context.request.url;

  if (!row) {
    return Response.redirect(new URL(FALLBACK, base).toString(), 302);
  }

  const hasValidLink =
    row.status === "active" ||
    row.status === "test"; // 'test' は検証専用カジノ（qa-test-casino）が使う
  const url = row.affiliate_url;

  if (!hasValidLink || !url || !isValidHttpsUrl(url)) {
    return Response.redirect(new URL(row.fallback_path, base).toString(), 302);
  }

  // クリック記録はリダイレクトをブロックしない。失敗してもユーザー体験に影響させない。
  context.waitUntil(
    recordClick(context.env.CASINO_DB, row.id).catch(() => {
      /* 記録失敗はリダイレクト自体の成否に影響させない */
    })
  );

  return Response.redirect(url, 302);
};
