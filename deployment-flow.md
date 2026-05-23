# deployment-flow.md

## リベンジカジノ比較ガイド デプロイ運用フロー

最終更新日: 2026-05-23  
対象サイト: リベンジカジノ比較ガイド  
本番URL: https://revenge-casino-guide.com  
GitHub repo: ShonShonChan/seo-pages  
branch: main  
公開基盤: Cloudflare Pages  
bot実行基盤: Cloudflare Worker  
操作画面: Telegram

---

## 1. このファイルの目的

このファイルは、リベンジカジノ比較ガイドの更新・公開・確認・復旧手順を整理するための運用メモです。

Telegram bot / AIエージェントは、このファイルを参照して以下を判断する。

- GitHubで何を更新するか
- 更新後に何を確認するか
- Cloudflare Pagesにどう反映されるか
- sitemap.xml / robots.txt / URL基準が正しいか
- トラブル時にどこを確認するか
- 次に管理者へ何を案内するか

---

## 2. 現在の基本構成

現在の完成形は以下。

```text
Telegram
↓
Cloudflare Worker Telegram bot
↓
GitHub APIでファイル更新
↓
GitHub repo: ShonShonChan/seo-pages
↓
Cloudflare Pages が自動デプロイ
↓
https://revenge-casino-guide.com で公開
