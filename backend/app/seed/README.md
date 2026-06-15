# 企業モックデータ（100社）

企業側の動作確認・デモ用の架空企業100社のデータセットと投入ツール。

## ファイル

| ファイル | 役割 |
|---|---|
| `companies.json` | 100社の生成済みデータ（リッチ版：メタ情報＋実態6項目） |
| `generate_companies.py` | `companies.json` を生成するスクリプト（再現用・乱数シード固定） |
| `seed.py` | データストアへ投入するスクリプト |

## データ構造

各社は `CompanyRealityInput` 準拠の実態項目に加え、`metadata` を持つ。

```json
{
  "company_id": "company-001",
  "job_id": "job-001",
  "metadata": {
    "name": "株式会社クラウドリンク",
    "industry": "IT・SaaS",
    "employee_count": 11,
    "size_band": "スタートアップ",
    "region": "東京",
    "founded_year": 2020,
    "remote_policy": "フルリモート",
    "overtime_band": "ほぼなし",
    "leave_ease": "高",
    "culture_tags": ["自走・裁量重視", "チームワーク重視"]
  },
  "job_title": "カスタマーサクセス",
  "daily_tasks": "...",
  "ojt_structure": "...",
  "leave_reality": "...",
  "culture_values": "...",
  "evaluation_criteria": "...",
  "workstyle": "..."
}
```

## 偏りのない配分

100社は以下の軸でバランス配分している（業界と各軸をずらして相関を断つ）。

- **業界**: 20業界 × 各5社
- **規模**: スタートアップ / 中小 / 中堅 / 大企業 / 超大手 を各20社
- **地域**: 15エリア（東京〜那覇＋フルリモート）に均等
- **残業**: ほぼなし / 少なめ / 標準 / やや多め / 繁忙期集中 を各20社
- **有休取得しやすさ**: 高 / 中 / 低 をほぼ均等
- **働き方**: フルリモート〜現場シフトまで（現場系業界は出社寄りに補正）
- **文化タグ**: 12種から各社2つ

## 使い方

### 1) データを生成し直す（任意）

```bash
python backend/app/seed/generate_companies.py
```

### 2) データストアへ投入する

**直書きモード（デフォルト）** — Firestore設定時は永続化、未設定時はin-memory：

```bash
cd backend && venv/bin/python -m app.seed.seed
cd backend && venv/bin/python -m app.seed.seed --reset   # 既存を消してから投入
```

> in-memoryストアはプロセスごとに独立するため、別プロセスで起動中の
> uvicorn には反映されない。起動中サーバに入れたい場合は次のAPI経由を使う。

**API経由モード** — 起動中バックエンドへPOST：

```bash
# 先にバックエンドを起動しておくこと
cd backend && venv/bin/python -m app.seed.seed --via-api
cd backend && venv/bin/python -m app.seed.seed --via-api --base-url http://127.0.0.1:8000
```

> API経由は `CompanyRealityInput` のフィールドのみ受け付けるため、`metadata`
> （社名・業界など）は保存されない。メタ情報も含めて保存したい場合は直書きモードを使う。
