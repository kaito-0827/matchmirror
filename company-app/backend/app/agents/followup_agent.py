"""
FollowUpAgent: 内定前後の不安解消タスクとコミュニケーション計画を生成する。
診断結果を入力として 30/60/90 日前後のフォロー計画を返す。
"""
import uuid
from typing import List
from app.agents.base import call_gemini, parse_json_response
from app.models.followup import FollowUpTask, TaskStatus
import logging

logger = logging.getLogger(__name__)


async def generate_followup_plan(
    gaps: List[dict],
    questions: List[dict],
    overall_score: int,
) -> List[FollowUpTask]:
    """
    ギャップと生成された質問から、入社前後のフォロータスクを生成する。
    """
    gaps_text = "\n".join(
        f"- {g.get('axis')}: {g.get('title')} (severity={g.get('severity')})"
        for g in gaps
    )
    prompt = f"""
あなたはMatchMirrorのFollowUpAgentです。内定後から入社後30日までの
フォロータスクを生成してください。

ルール:
- タスクは具体的なアクション（面談設定、資料共有、現場接点）
- 入社前: 30日前、14日前などタイムラインを明示する
- 入社後: 7日後、30日後などタイムラインを明示する
- 担当者(owner)は「人事担当」「現場マネージャー」「AIエージェント」のいずれか
- 候補者の不安カテゴリに対応した具体的なタスク

## 検出されたギャップ
{gaps_text}

## 総合スコア
{overall_score}

## 出力形式（JSON）
{{
  "tasks": [
    {{
      "title": "タスクの具体的なアクション",
      "axis": "対応するギャップの軸名",
      "due_label": "入社30日前",
      "days_before_join": 30,  // 入社前はこれを設定、入社後はnull
      "days_after_join": null, // 入社後はこれを設定、入社前はnull
      "owner": "人事担当",
      "detail": "詳細説明（任意）"
    }}
  ],
  "owner_suggestion": "フォロー計画の主担当者の推奨"
}}

最大6タスク。入社前と入社後をバランスよく混ぜる。JSON のみ返してください。
"""
    try:
        text = await call_gemini(prompt, expect_json=True)
        data = parse_json_response(text)
        return [
            FollowUpTask(
                id=str(uuid.uuid4()),
                title=t["title"],
                axis=t["axis"],
                due_label=t["due_label"],
                days_before_join=t.get("days_before_join"),
                days_after_join=t.get("days_after_join"),
                owner=t["owner"],
                detail=t.get("detail"),
                status=TaskStatus.pending,
            )
            for t in data.get("tasks", [])
        ]
    except Exception as e:
        logger.error(f"FollowUpAgent failed: {e}")
        return _mock_tasks(gaps)


def _mock_tasks(gaps: List[dict]) -> List[FollowUpTask]:
    has_ojt = any("OJT" in g.get("title", "") or "文化" in g.get("axis", "") for g in gaps)
    has_leave = any("有休" in g.get("title", "") or "条件" in g.get("axis", "") for g in gaps)
    tasks = [
        FollowUpTask(
            id=str(uuid.uuid4()),
            title="OJT担当者との15分面談を設定" if has_ojt else "配属先マネージャーとの面談を設定",
            axis="OJT体制" if has_ojt else "文化・価値観",
            due_label="入社30日前",
            days_before_join=30,
            days_after_join=None,
            owner="人事担当",
            detail="育成体制・相談頻度・Slackルールを事前に共有する",
            status=TaskStatus.pending,
        ),
        FollowUpTask(
            id=str(uuid.uuid4()),
            title="配属後1カ月の業務例を共有",
            axis="仕事内容",
            due_label="入社14日前",
            days_before_join=14,
            days_after_join=None,
            owner="現場マネージャー",
            detail="入社後の具体的な業務内容・タスク例をドキュメントで共有",
            status=TaskStatus.pending,
        ),
        FollowUpTask(
            id=str(uuid.uuid4()),
            title="有休・残業の運用実態を説明" if has_leave else "働き方・業務ルールのオンボーディング",
            axis="有休運用" if has_leave else "働き方",
            due_label="入社後7日",
            days_before_join=None,
            days_after_join=7,
            owner="人事担当",
            detail="制度説明に加え、実際の取得状況や申請フローを口頭で説明",
            status=TaskStatus.pending,
        ),
        FollowUpTask(
            id=str(uuid.uuid4()),
            title="不安スコアを再確認",
            axis="フォロー確認",
            due_label="入社後30日",
            days_before_join=None,
            days_after_join=30,
            owner="AIエージェント",
            detail="CandidateAgentが1ヶ月後の満足度・不安を再ヒアリング",
            status=TaskStatus.pending,
        ),
    ]
    return tasks
