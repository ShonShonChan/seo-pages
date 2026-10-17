-- RankCraft フェーズ1: AFF/カジノ・マスターデータ
-- D1にはマイグレーション管理機構がないため、再現性のためこのファイルをrepoに残す。
-- 初回適用: wrangler d1 execute rankcraft-casinos --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS casinos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  affiliate_url TEXT,                      -- 未設定の間はNULL（収益化リンク未確定）
  fallback_path TEXT NOT NULL,             -- affiliate_url未設定時の転送先（例: '/review-konibet.html'）
  status TEXT NOT NULL DEFAULT 'pending',  -- 'active' | 'pending' | 'test'
  estimated_rate REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clicks (
  casino_id INTEGER NOT NULL REFERENCES casinos(id),
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (casino_id, date)
);

-- seed: 実際に収益化済みなのはスロット天国のみ。他14カジノはfallback_pathのみ設定し、
-- affiliate_urlはadmin画面から後日入力する。qa-test-casinoは検証専用（本番slugと衝突しない）。
INSERT OR IGNORE INTO casinos (slug, name, affiliate_url, fallback_path, status) VALUES
  ('slottenkoku',    'スロット天国',        'https://sloten.io?referral=0ZjM', '/review-slottenkoku.html', 'active'),
  ('konibet',        'コニベット',           NULL, '/review-konibet.html',        'pending'),
  ('stake',          'Stake',               NULL, '/review-stake.html',          'pending'),
  ('mystino',        'ミスティーノ',         NULL, '/review-mystino.html',        'pending'),
  ('verajohn',       'ベラジョン',           NULL, '/review-verajohn.html',       'pending'),
  ('yuugado',        '遊雅堂',              NULL, '/review-yuugado.html',        'pending'),
  ('bcgame',         'BC.GAME',             NULL, '/review-bcgame.html',         'pending'),
  ('bitcasino',      'ビットカジノ',         NULL, '/review-bitcasino.html',      'pending'),
  ('bitstarz',       'BitStarz',            NULL, '/review-bitstarz.html',       'pending'),
  ('bons-casino',    'ボンズカジノ',         NULL, '/review-bons-casino.html',    'pending'),
  ('casino-secret',  'カジノシークレット',   NULL, '/review-casino-secret.html',  'pending'),
  ('fortunejack',    'FortuneJack',         NULL, '/review-fortunejack.html',    'pending'),
  ('roobet',         'Roobet',              NULL, '/review-roobet.html',         'pending'),
  ('vave',           'Vave',                NULL, '/review-vave.html',           'pending'),
  ('7bitcasino',     '7Bit Casino',         NULL, '/review-7bitcasino.html',     'pending'),
  ('qa-test-casino', 'QAテスト用',           'https://example.com/qa-test',     '/casino-list.html', 'test');
