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
