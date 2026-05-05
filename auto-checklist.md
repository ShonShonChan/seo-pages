# リベンジカジノ比較ガイド｜auto-checklist.md

このファイルは、botが新規ページ作成・既存ページ修正・キャンペーンページ追加・レビュー追加を行ったあとに、必ず確認するためのチェックリストです。

対象サイト：

- リベンジカジノ比較ガイド
- 静的HTML運用
- GitHub Pages公開
- HTMLと画像は基本的に同じ階層に配置

---

## 1. 作業前確認

botは作業前に以下を確認する。

- [ ] `bot-handoff.md` を確認した
- [ ] 作成対象ページの種類を確認した
  - [ ] レビュー記事
  - [ ] キャンペーンページ
  - [ ] ガイド記事
  - [ ] 比較ページ
  - [ ] 既存ページ修正
- [ ] 使用するテンプレートを確認した
  - [ ] `template-review.html`
  - [ ] `template-campaign.html`
  - [ ] その他
- [ ] 既存ページのデザイン方針を確認した
- [ ] 赤×白基調、ゴールドアクセントの方針を維持した
- [ ] 煽り表現を避ける方針を確認した

---

## 2. 新規HTMLファイル確認

新規ページを作成した場合、以下を確認する。

- [ ] ファイル名が英小文字・ハイフン区切りになっている
- [ ] 拡張子が `.html` になっている
- [ ] 既存ファイル名と重複していない
- [ ] GitHub Pagesで扱いやすいファイル名になっている
- [ ] 日本語ファイル名を使っていない
- [ ] スペースを含むファイル名になっていない

レビュー記事の場合：

- [ ] `review-xxxx.html` の形式になっている

キャンペーンページの場合：

- [ ] `campaign-xxxx.html` の形式になっている

ガイド記事の場合：

- [ ] `guide-xxxx.html` の形式になっている

---

## 3. HTML基本構造チェック

各HTMLファイルで以下を確認する。

- [ ] `<!DOCTYPE html>` がある
- [ ] `<html lang="ja">` になっている
- [ ] `<meta charset="UTF-8" />` がある
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` がある
- [ ] `<title>` がある
- [ ] `meta description` がある
- [ ] `<body>` がある
- [ ] `<main>` がある
- [ ] `<footer>` がある
- [ ] HTMLタグの閉じ忘れがない
- [ ] 不要なテンプレート用コメントが残りすぎていない
- [ ] `{{PLACEHOLDER}}` が残っていない

特に確認する置換漏れ：

- [ ] `{{CASINO_NAME}}` が残っていない
- [ ] `{{CAMPAIGN_NAME}}` が残っていない
- [ ] `{{MAIN_CONDITION}}` が残っていない
- [ ] `{{WAGERING_REQUIREMENT}}` が残っていない
- [ ] `{{PAYMENT_METHOD_1}}` などが残っていない

---

## 4. SEO基本チェック

各ページで以下を確認する。

- [ ] title がページ内容と一致している
- [ ] title が長すぎない
- [ ] meta description がページ内容と一致している
- [ ] meta description が空ではない
- [ ] h1 が1つだけある
- [ ] h1 がページ内容と一致している
- [ ] h2 が自然に使われている
- [ ] 見出し順が不自然ではない
- [ ] キーワードを詰め込みすぎていない
- [ ] 日本語として自然に読める
- [ ] 既存ページと同じtitleを使い回していない

---

## 5. 共通ヘッダーチェック

全ページで以下を確認する。

- [ ] ヘッダーがある
- [ ] サイト名が表示されている
- [ ] `index.html` へのリンクがある
- [ ] ナビゲーションがある
- [ ] 以下のリンクがある

```html
<a href="index.html">TOP</a>
<a href="casino-list.html">カジノ一覧</a>
<a href="review.html">レビュー</a>
<a href="bonus.html">ボーナス比較</a>
<a href="payments.html">入出金</a>
<a class="nav-cta" href="guide.html">初心者ガイド</a>

## 日本語HTML編集・一括置換時の安全ルール

- 作業前に必ず git status を確認する
- 作業前の理想状態は working tree clean
- 日本語HTMLを一括置換する場合、Get-Content / Set-Content の安易な使用は避ける
- 文字化け防止のため、System.IO.File.ReadAllText / WriteAllText と UTF8Encoding(false) を使う
- 置換前に Select-String で対象件数と対象ファイルを確認する
- 置換後に Select-String で誤表記が残っていないか確認する
- git diff で文字化けや余計な変更がないか確認する
- commit / push 前に必ずユーザー確認を取る
- ユーザー承認なしで commit / push しない
