# MatchMirror

採用ミスマッチを**入社前**に可視化するAIエージェントサービス。

企業の「実態」と候補者の「希望・不安・価値観」を6軸で照合し、ズレ（懸念点）を
スコアと根拠（evidence）付きで提示する。スコアは採用合否ではなく、**面談で確認すべき
論点の多さ**を示す指標として設計している。

## 解決したい課題

求人票・面接での印象と、入社後の実態（働き方・文化・育成体制など）にギャップが
あることが早期離職の一因になっている。MatchMirrorは、その確認漏れを事前に
構造化して洗い出すことで、候補者・企業の双方が「確認すべきこと」を面談前に
把握できるようにする。

## アーキテクチャ

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  React SPA   │ ───▶ │   FastAPI API     │ ───▶ │   Gemini    │
│  (Vite, src/)│      │  (backend/app/)   │      │ (2.5 flash) │
└─────────────┘      └──────────────────┘      └─────────────┘
                              │
                              ▼
                      Firestore（本番）/
                      in-memory store（開発）
```

- フロントエンド: React 19 + TypeScript + Vite + Tailwind、Firebase Authでログイン
- バックエンド: FastAPI、Geminiを呼ぶ8つのAIエージェントで構成
- データ層: Firestore（`GOOGLE_CLOUD_PROJECT`設定時）。未設定時はin-memoryに自動フォールバックし、ローカルでAPIキーなしでも一通り動作確認できる
- デプロイ: フロントはVercel、バックエンドはGitHub Actions経由でCloud Run（`.github/workflows/deploy-backend.yml`）

## AIエージェント構成

| エージェント | 役割 |
|---|---|
| `CompanyAgent` | 企業実態を構造化し、CompanyRealityProfileを生成 |
| `CandidateAgent` | 候補者の希望・不安・価値観を対話で抽出 |
| `MismatchAgent` | 企業実態と候補者希望を6軸で照合しズレを検出（スコア・根拠・確認質問） |
| `QuestionAgent` | 面接・面談で確認すべき質問を優先度順に生成 |
| `FollowUpAgent` | 内定前後の不安解消タスクとコミュニケーション計画を生成 |
| `RecommendAgent` | 診断シグナルから合う企業をランキング推薦 |
| `InterviewAgent` | マッチング成立後の双方向け面談メモを生成 |
| `GuardrailAgent` | AI出力の差別性・断定表現・個人情報過剰露出を検査し、安全な表現に修正 |

照合の6軸: 仕事内容 / 働き方 / 条件・制度 / 文化・価値観 / 成長・キャリア / 不安・未確認点

### ガードレール設計

`MismatchAgent`の出力は`GuardrailAgent`（`backend/app/agents/guardrail_agent.py`）を必ず通る
（`backend/app/routers/reports.py`）。年齢・性別・既婚/未婚・妊娠出産・障害・国籍などの
属性パターンと、「合格/不合格」のような断定表現をルールベースで検出し、引っかかった場合は
Geminiで安全な表現に書き直す。採用差別につながる出力を技術的に防ぐためのレイヤー。

## ディレクトリ構成

```
src/            フロントエンド（候補者・企業の両フローを1つのSPAで提供）
backend/app/    FastAPIバックエンド
  agents/       Geminiを呼ぶ8エージェント（APIキー未設定時はモック応答にフォールバック）
  routers/      APIエンドポイント
  models/       Pydanticモデル
  db/           Firestore / in-memoryストア
  seed/         デモ用企業100社のシードデータ・投入スクリプト
backend/tests/  pytest（in-memoryストア・モックエージェントで実行）
```

## セットアップ

### フロントエンド

```bash
npm install
cp .env.example .env   # Firebase未設定でもゲスト動作で診断・レポート生成は可能
npm run dev             # http://localhost:5173
```

### バックエンド

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # GOOGLE_GEMINI_API_KEY は https://aistudio.google.com で取得
uvicorn app.main:app --reload --port 8000
```

`GOOGLE_GEMINI_API_KEY`未設定でも各エージェントはモック応答で動作する（開発・デモ用）。
`GOOGLE_CLOUD_PROJECT`未設定時はFirestoreの代わりにin-memoryストアを使う。

### デモデータの投入（任意）

```bash
cd backend && python -m app.seed.seed
```

20業界×規模×地域×残業傾向などの軸でバランス配分した企業100社を投入する
（詳細は `backend/app/seed/README.md`）。

### テスト

```bash
cd backend && pytest
```

## デプロイ

- フロントエンド: Vercel（`vercel.json`、`vite build` → `dist/`）
- バックエンド: `main`ブランチへの`backend/**`変更で GitHub Actions が
  Workload Identity Federation経由でCloud Run（asia-northeast1）へデプロイ
  （`.github/workflows/deploy-backend.yml`）
