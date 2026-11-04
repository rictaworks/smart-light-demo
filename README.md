# Smart Light Demo

人感センサー連動の照明自動制御 IoT シミュレーター（デモ版）。

---

## 自動ログイン（開発環境）

開発環境では認証フローをスキップし、セッション ID を自動生成して認証済み状態で起動する。

```bash
# プロジェクトルートの .env に以下を設定する
ENV=development
```

---

## 起動手順

```bash
# 1. .env を配置（初回のみ）
cp .env.example .env   # または直接 .env を作成

# 2. バックエンド（プロジェクトルートから実行）
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# 3. フロントエンド（別ターミナル）
cd frontend
npm install
npm run dev
```

バックエンド: http://localhost:8000  
フロントエンド: http://localhost:3000  
API Docs (Swagger): http://localhost:8000/docs

---

## テスト実行

```bash
# バックエンド（プロジェクトルートから）
python -m pytest test/backend/ -v

# フロントエンド
cd frontend
npm test
```

---

## ページ一覧

| ページ名 | URL |
|---|---|
| ダッシュボード（メイン） | [http://localhost:3000/](http://localhost:3000/) |

---

## API 一覧

仕様詳細: [http://localhost:8000/docs](http://localhost:8000/docs)

| タイトル | エンドポイント | 説明 |
|---|---|---|
| セッション作成 | `POST /api/session` | UUID v4 セッション ID を Cookie に発行 |
| センサー状態更新 | `POST /api/sensor` | センサー検知・照度を更新しデバウンス開始 |
| 照明状態取得 | `GET /api/light` | 現在の照明・センサー・省エネ状態を返す |
| 照明手動制御 | `POST /api/light/manual` | 手動で ON/OFF・輝度を設定 |
| 自動モード復帰 | `POST /api/light/auto` | センサー連動の自動制御に戻す |
| 省エネログ取得 | `GET /api/energy` | 過去24時間の省エネログを返す |
| 設定取得 | `GET /api/settings` | デバウンス秒・待機秒・目標照度等を返す |
| 設定更新 | `PUT /api/settings` | 上記設定を更新 |
| DB リセット（手動） | `POST /api/admin/reset` | 全データを削除して初期化 |

---

## ディレクトリ構成

```
smart-light-demo/
├── backend/                    # Python FastAPI
│   ├── main.py                 # アプリエントリーポイント・CORS・lifespan
│   ├── config.py               # .env 読み込み
│   ├── requirements.txt
│   ├── db/
│   │   ├── schema.sql          # SQLite テーブル定義
│   │   ├── database.py         # 接続管理・初期化
│   │   └── session_repository.py  # 全 DB 操作（session_id フィルタ付き）
│   ├── services/
│   │   ├── state_manager.py    # asyncio タスクで in-memory ステートマシン管理
│   │   ├── sensor_service.py   # 3センサーの状態管理
│   │   ├── light_controller.py # 照明 ON/OFF・輝度・モード制御
│   │   ├── energy_calculator.py # ON 時間・kWh 計算
│   │   └── schedule_checker.py  # 消灯時間帯判定（日またぎ対応）
│   ├── routers/
│   │   ├── session.py / sensor.py / light.py
│   │   ├── energy.py / settings.py / admin.py
│   └── tasks/
│       └── db_reset.py         # APScheduler で JST 03:00 自動リセット
├── frontend/                   # Next.js (TypeScript)
│   ├── pages/
│   │   ├── _app.tsx            # Font Awesome CDN・グローバル CSS
│   │   └── index.tsx           # ダッシュボード（1秒ポーリング）
│   ├── components/
│   │   ├── SensorPanel.tsx     # 3センサーカード・照度スライダー
│   │   ├── LightControl.tsx    # 電球ビジュアル・モード切替
│   │   ├── BrightnessSlider.tsx # 輝度スライダー（手動モード時のみ有効）
│   │   ├── EnergyChart.tsx     # Chart.js 折れ線グラフ・省エネサマリー
│   │   └── ScheduleSettings.tsx # 設定フォーム（デバウンス・消灯スケジュール等）
│   ├── lib/api.ts              # fetch ラッパー（credentials: include）
│   └── types/index.ts          # 共通型定義
├── test/
│   ├── backend/                # pytest（47件）
│   └── frontend/               # Jest ソース（18件）
├── SPEC/                       # 設計図（Mermaid）
│   ├── ER.md                   # ER 図
│   ├── DFD.md                  # DFD
│   ├── sequence.md             # シーケンス図
│   ├── class.md                # クラス図
│   ├── state.md                # 状態遷移図
│   └── usecase.md              # ユースケース図
├── ENV/
│   ├── DEVELOPMENT.md
│   └── PRODUCTION.md
├── .env                        # 環境変数（git 管理外）
├── CLAUDE.md                   # Claude 開発ルール
└── smart-light-demo-spec.md    # 設計仕様書
```

---

## 技術スタック

| 区分 | 技術 |
|---|---|
| フロントエンド | Next.js 14 (TypeScript) |
| バックエンド | Python FastAPI |
| DB | SQLite（WAL モード・毎日 JST 03:00 自動リセット） |
| グラフ | Chart.js / react-chartjs-2 |
| アイコン | Font Awesome 6 |
| スケジューラ | APScheduler 3 |
| テスト（BE） | pytest / httpx |
| テスト（FE） | Jest / @testing-library/react |

---

## 仕様書・設計図

| ドキュメント | リンク |
|---|---|
| 設計仕様書 | [smart-light-demo-spec.md](./smart-light-demo-spec.md) |
| ER 図 | [SPEC/ER.md](./SPEC/ER.md) |
| DFD | [SPEC/DFD.md](./SPEC/DFD.md) |
| シーケンス図 | [SPEC/sequence.md](./SPEC/sequence.md) |
| クラス図 | [SPEC/class.md](./SPEC/class.md) |
| 状態遷移図 | [SPEC/state.md](./SPEC/state.md) |
| ユースケース図 | [SPEC/usecase.md](./SPEC/usecase.md) |

---

## Cloudflare 版：秘密と運用方針

### 全体リセット（運用者専用）

- `POST /api/admin/reset` は全セッションのデータを削除する。Cookie では実行できず、ヘッダー `X-Admin-Token` が Worker の secret `ADMIN_RESET_TOKEN` と一致したときだけ動く。
- 本番での設定: `npx wrangler secret put ADMIN_RESET_TOKEN`（値はチャットやファイルに書かない）。
- ローカルでの設定: `.dev.vars`（git 管理外）に `ADMIN_RESET_TOKEN=...` を書く。
- `ADMIN_RESET_TOKEN` が未設定（または空）なら、このエンドポイントは無効（404）になる。
- 画面の「リセット」ボタンは、そのセッションのデータだけを削除する（`POST /api/session/reset`）。押すと確認が出る。

### セッション

- セッション ID は HttpOnly・Secure・SameSite=Lax の Cookie でだけ渡し、本文には含めない。
- 日次リセット（JST 03:00 = UTC 18:00、cron `0 18 * * *`）で全データを削除する。

### 入力

- 本文を持つ POST/PUT は `Content-Type: application/json` が必要。それ以外は 415 を返す。

### レート制限（方針・未設定）

- アプリ内ではレート制限を実装していない。Cloudflare の Rate Limiting Rules で行う（デプロイ時にダッシュボードで設定する）。
- 目安: `/api/session` は 1 IP あたり 10 回/分、`/api/admin/reset` は 1 IP あたり 5 回/分（トークンの総当たり対策）、`/api/*` 全体は 1 IP あたり 300 回/分（画面は 1 秒ポーリングで約 60 回/分）。超えた場合は 429 を返す設定にする。
