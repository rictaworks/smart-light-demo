# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 削除系コマンドの禁止（重要）

- Claude はファイルまたはディレクトリを削除するコマンドを一切生成してはならない。
  例：rm, rm -rf, rm *, rmdir, unlink, cache --delete,
      lftp mirror --delete, rsync --delete, git clean -df, find -delete 等。
- 削除が必要な場合は「手動で削除してください」といった説明に留めること。
- ssh / lftp / デプロイ系スクリプトを生成する場合でも削除コマンドの生成は禁止。

---

## プロジェクト概要

IoT 照明シミュレーターのデモアプリ。

- **フロントエンド**: Next.js 14 (TypeScript) → Vercel (`smart-light-demo.rictaworks.jp`)
- **バックエンド**: FastAPI + SQLite → Railway
- **セッション**: Cookie (`session_id`) による UUID ベースの匿名セッション
- Vercel は GitHub 未連携のため、デプロイは `frontend/` 内で `vercel --prod --yes` を手動実行する

---

## コマンド

### バックエンド

```bash
# 依存インストール
pip install -r requirements.txt

# 開発サーバー起動（プロジェクトルートから）
uvicorn backend.main:app --reload

# テスト（全件）
pytest test/backend/

# テスト（単一ファイル）
pytest test/backend/test_api.py

# テスト（単一ケース）
pytest test/backend/test_api.py::test_create_session
```

### フロントエンド

```bash
cd frontend

# 開発サーバー
npm run dev

# ビルド
npm run build

# テスト（全件）
npm test

# テスト（ウォッチモード）
npm run test:watch

# 本番デプロイ（Vercel 手動）
vercel --prod --yes
```

---

## アーキテクチャ

### セッション管理の二重構造

リクエストごとに **DB（SessionRepository）** と **インメモリ状態（StateManager）** の両方を持つ。

```
Cookie(session_id)
    ↓
SessionRepository  ← SQLite（永続化）
    ↓ settings / light_state を読み込み
StateManager
    └── SessionState  ← asyncio.Task でデバウンス・待機タイマーを保持
          ├── SensorService（センサー状態集約）
          ├── LightController（照明状態・輝度計算）
          ├── EnergyCalculator（省エネ計算）
          └── ScheduleChecker（消灯スケジュール判定）
```

- Railway 再起動時にインメモリ状態は消える。`POST /api/session` がアクセスのたびに DB から状態を復元する。
- `StateManager.remove()` はタスクをキャンセルしてからエントリを削除する。

### センサー → 照明制御フロー

1. `POST /api/sensor` → `SessionState.process_sensor_update()`
2. センサーの集約状態が変化した場合のみ、`_debounce_sec` 秒待機するデバウンスタスクを起動
3. デバウンス完了 → `_apply_light_control()`
   - 手動モードなら何もしない
   - 消灯スケジュール中なら消灯
   - 人検知あり → 即時点灯、待機タイマーキャンセル
   - 人検知なし → `_wait_sec` 秒後に消灯するタスクを起動（既存タスクがあればスキップ）

### DB スキーマ

`backend/db/schema.sql` に `CREATE TABLE IF NOT EXISTS` で定義。
主要テーブル: `sessions`, `settings`, `light_states`, `sensor_logs`, `energy_logs`

`SessionRepository` がすべての DB 操作をカプセル化し、コネクションは使用ごとに open/close する（SQLite の並行書き込みを避けるため WAL モード使用）。

### フロントエンド状態更新

`pages/index.tsx` の `handleReset()` はポーリングの競合を防ぐため以下の順で処理する：

1. `clearInterval(pollRef.current)` — 同期的にポーリング停止
2. `setReady(false)` — useEffect によるポーリング再起動を防止
3. `api.resetDb()` → `api.createSession()` — DB リセット後に新セッションを作成
4. データ再取得 → `setReady(true)` — ポーリング再開

---

## 環境変数

| 変数 | デフォルト | 説明 |
|---|---|---|
| `DATABASE_URL` | `smart_light.db` | SQLite ファイルパス |
| `FRONTEND_URL` | `http://localhost:3000` | CORS 許可オリジン |
| `ENV` | `production` | 環境識別子 |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | フロントからのバックエンド URL |

---

## 開発ルール

- **main ブランチでの作業禁止**（`src/*` 変更は PR 必須）
- TDD：plan → red test → coding → green test
- バックエンドテスト：pytest、フロントエンドテスト：Jest
- アイコン：Font Awesome 使用（絵文字禁止）
- `alert()` / `confirm()` / `prompt()` は使用禁止
- フォールバック処理禁止・例外処理は必ず実装
- PR 本文には非エンジニア向けユーザーテスト手順を記載
- commit 前に `/security-review` を実行
