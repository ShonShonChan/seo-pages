# リベンジカジノ比較ガイド｜bot引き継ぎ仕様書

## サイト概要

サイト名：リベンジカジノ比較ガイド

このサイトは、オンラインカジノを「勝てる」「稼げる」「取り返せる」といった煽り表現で紹介するサイトではありません。

目的は、オンラインカジノを利用する前に確認すべき条件を整理することです。

主に確認する内容：

- ボーナス条件
- 賭け条件
- 最大出金
- 有効期限
- 対象ゲーム
- 禁止ベット
- 入出金条件
- 本人確認
- 公式規約
- 対象地域
- 年齢制限
- 暗号資産利用時の注意
- 責任ある利用

「リベンジ」は、損失回収や勝利保証ではなく、

> 前回の失敗を学びに変え、次は条件を確認して賢く選ぶ

という意味で扱う。

---

## デザインルール

基本カラー：

- メイン：赤
- 背景：白
- アクセント：ゴールド

デザイン方針：

- 赤×白を基調にする
- ゴールドはアクセントに限定する
- 本文・比較表は白背景で読みやすくする
- 炎や熱量のある表現はヒーローやCTA周辺に限定する
- スマホ表示で崩れないようにする
- 煽りすぎず、条件確認しやすいデザインにする

---

## 既存ページ一覧

主要ページ：

- index.html
- casino-list.html
- review.html
- bonus.html
- bonus-guide.html
- payments.html
- guide.html
- site-checklist.html

個別レビュー：

- review-slottenkoku.html
- review-konibet.html
- review-stake.html
- review-verajohn.html
- review-yuugado.html
- review-bitcasino.html
- review-mystino.html
- review-casino-secret.html
- review-bons-casino.html
- review-bcgame.html

---

## 画像ファイル

画像はHTMLに埋め込まず、HTMLと同じ階層に置いて相対パスで参照する。

既存画像：

- slottenkoku-logo.png
- konibet-logo.png
- stake-logo.png
- yuugado-logo.png
- ribedan-point.png
- ribedan-guide.png
- ribejo-note.png
- ribejo-warning.png

マスコット名：

- リベ男：ribedan
- リベ女：ribejo

既存ロゴ画像は消さないこと。

ロゴがないカジノは、画像ではなくテキスト型プレースホルダーを使う。

例：

```html
<div class="logo-placeholder">Casino Secret</div>

## Telegram bot GitHub運用ルール

### 現在できること

Telegram bot から Cloudflare Worker 経由で GitHub リポジトリ `ShonShonChan/seo-pages` を操作できる。

現在対応している主なコマンド：

- `github test`
  - GitHub接続確認
  - `index.html` を読み取れるか確認する

- `github rules test`
  - `bot-handoff.md` と `auto-checklist.md` の読み取り確認

- `github diagnose <page>`
  - 指定HTMLを静的SEO診断する
  - title / description / h1 / h2 / 内部リンク / 画像alt / 危険表現候補を確認する
  - GitHubへの書き込みは行わない

- `github scan`
  - 主要HTMLをまとめて静的スキャンする
  - GitHubへの書き込みは行わない

- `github propose <page>`
  - 指定HTMLの改善案を返す
  - GitHubへの書き込みは行わない

- `github diff <page>`
  - 安全な範囲の差分プレビューを作成する
  - 差分は保留状態として一時保存される
  - GitHubへの書き込みはまだ行わない

- `github apply <page>`
  - 直前に `github diff <page>` で作成した差分だけをGitHubへcommitする
  - diffなしで直接applyしてはいけない
  - apply対象は直前のdiffと同一ページに限定する

### 安全運用ルール

- いきなり `github apply <page>` を実行しない
- 必ず先に `github diff <page>` を確認する
- 差分内容が自然で、意味が崩れていない場合だけ `github apply <page>` を実行する
- apply後はGitHubのcommit画面で変更ファイル数と差分を確認する
- apply後はGitHub Pagesの公開URLでも反映を確認する
- 複数ページを一括applyしない
- 1回のcommitでは原則1ページだけ変更する
- P11.6 は確認待ちのため、勝手に修正・apply・commitしない

### 自動修正の対象範囲

現在の `github apply` は、安全性を優先して以下の静的修正だけを対象にする。

- 危険表現候補の置換
- titleがない場合の追加
- titleが長すぎる場合の短縮
- meta descriptionがない場合の追加
- meta descriptionが長すぎる場合の短縮

現在は以下を自動修正対象にしない。

- 本文全体の大幅リライト
- CTA文言の大幅変更
- HTML構造の大幅変更
- 画像ファイルの変更
- 複数ページ一括commit
- AIが自由生成した文章の自動反映

### 危険表現ルール

以下のような表現は避ける。

- 必ず勝てる
- 絶対勝てる
- 確実に勝てる
- 確実に稼げる
- 必ず稼げる
- 勝利保証
- 出金保証
- 損失回収
- 負けを取り戻す
- 一攫千金

言い換え方針：

- 勝利保証ではなく、条件確認・公式規約確認に寄せる
- 損失回収ではなく、リスク理解・失敗を次の確認に活かす文脈にする
- 煽りではなく、比較・条件確認・初心者理解を重視する

### 通常運用フロー

新規ページや既存ページを確認する時：

1. `github diagnose <page>`
2. `github propose <page>`
3. 必要な場合だけ `github diff <page>`
4. 差分確認後、問題なければ `github apply <page>`
5. GitHub commit確認
6. GitHub Pages公開URLで反映確認

サイト全体を軽く確認する時：

1. `github scan`
2. 改善候補があるページだけ個別に確認する
3. 差分候補がないページはapplyしない

## Cloudflare Worker復旧手順

### 目的

Telegram bot のCloudflare Workerコードを誤って壊した場合に、正常動作していた状態へ戻すための手順。

### 現行バックアップ

現在の正常動作版Workerコードは以下に保存する。

- `worker-backups/telegram-seo-worker-current.js`

### 復旧手順

1. Cloudflare Dashboardを開く
2. 対象Workerを開く
3. `Edit code` を開く
4. `worker-backups/telegram-seo-worker-current.js` の中身を全コピーする
5. Cloudflareの `worker.js` に全貼り替えする
6. `Deploy` する
7. Telegram botで以下を確認する

```text
github test
github rules test
github scan
