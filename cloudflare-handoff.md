# cloudflare-handoff.md

## Cloudflare構成 引継ぎメモ

最終更新日: 2026-05-23  
対象サイト: リベンジカジノ比較ガイド  
本番ドメイン: https://revenge-casino-guide.com  
GitHub repo: ShonShonChan/seo-pages  
branch: main

---

## 1. 現在の完成形

現在の運用構成は以下。

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
