# Smart Light Demo

人感センサー連動の照明自動制御 IoT シミュレーター（デモ版）。

---

## 自動ログイン（開発環境）

開発環境では認証フローをスキップし、自動的に認証済み状態で起動する。

```bash
# .env に以下を設定する
ENV=development
```

`ENV=development` が設定された状態でサーバーを起動すると、セッション ID が自動生成されログイン済みとして扱われる。

---

## 起動手順

```bash
# バックエンド（Python FastAPI）
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# フロントエンド（Next.js）
cd frontend
npm install
npm run dev
```

---

## ページ一覧

| ページ名 | URL |
|---|---|
| ダッシュボード（メイン） | [http://localhost:3000/](http://localhost:3000/) |

---

## API 一覧

仕様詳細: [http://localhost:8000/docs](http://localhost:8000/docs)

| タイトル | エンドポイント |
|---|---|
| センサー状態更新 | `POST /api/sensor` |
| 照明状態取得 | `GET /api/light` |
| 照明手動制御 | `POST /api/light/manual` |
| 自動モード復帰 | `POST /api/light/auto` |
| 省エネログ取得 | `GET /api/energy` |
| 設定取得 | `GET /api/settings` |
| 設定更新 | `PUT /api/settings` |
| セッション作成 | `POST /api/session` |
| DB リセット（手動） | `POST /api/admin/reset` |

---

## 技術スタック

| 区分 | 技術 |
|---|---|
| フロントエンド | Next.js (TypeScript) |
| バックエンド | Python FastAPI |
| DB | SQLite（毎日 JST 03:00 自動リセット） |
| アイコン | Font Awesome |

---

## 仕様書

[smart-light-demo-spec.md](./smart-light-demo-spec.md)
