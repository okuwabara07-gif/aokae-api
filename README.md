# AOKAE API Server

Railway上で動作するAOKAEダッシュボード用APIサーバー。

## エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | / | ヘルスチェック |
| GET | /api/status | 全サイト稼働確認 |
| POST | /api/post-x | X投稿を今すぐ実行 |
| POST | /api/post-x-all | 全サイトX投稿 |
| GET | /api/articles | 記事数確認 |
| POST | /api/create-site | 新サイト作成 |
| POST | /api/rebuild | Vercelリビルド |
| GET | /api/revenue | 収益サマリー |

## 認証

全エンドポイントに `x-api-key` ヘッダーが必要。

## Railway環境変数

- `GITHUB_TOKEN` : GitHubトークン
- `API_SECRET` : APIキー（任意の文字列）

## デプロイ
```bash
railway up
```
