# ProtoPedia 提出内容（DevOps × AI Agent Hackathon 2026）

締切: 2026年7月10日(金) 23:59 — ProtoPedia登録後、Findy側の最終Google Formに
GitHub URL / デプロイURL / ProtoPedia URL を提出する。

## 作品ステータス
開発中（デプロイ済み・継続改善中）

## 作品タイトル
MatchMirror — AIエージェントが入社後ギャップを自律的に診断・フォローする採用ミスマッチ防止サービス

## 概要
求人票と入社後の実態のズレ（早期離職の最大要因）を、AIエージェントが企業実態ヒアリングと候補者チャット診断から自動で可視化。さらに自律判断エージェント（OrchestratorAgent）がギャップの深刻度から「確認質問を先にすべきか」「フォロー計画を直接作るべきか」を自分で判断し、優先質問の出し分け→入社前後のフォロー計画生成まで一気通貫で実行します。

## 作品のURL
https://matchmirror.vercel.app

## システム構成（テキスト補足）
Vercel(React/TypeScript) → Cloud Run(FastAPI) → 診断エージェント群がスコア/ギャップを算出 → OrchestratorAgentが自律判断 → FollowUpAgentがフォロー計画を生成。バックエンドはGemini API・Cloud Firestore・Firebase Authenticationと連携。
（画像: docs/assets/architecture.png）

## 開発素材
Gemini API / Cloud Run / Cloud Firestore / Firebase Authentication

## タグ
React, TypeScript, FastAPI, Python, Vite, Tailwind CSS, HRTech, AIエージェント, 採用ミスマッチ

## ストーリー
新卒・中途の早期離職の多くは「求人票と現場のギャップ」が原因です。MatchMirrorは、企業側には実際の業務・OJT・休暇実態などをヒアリングし、候補者側にはチャット形式で価値観・働き方の希望を診断、両者のズレをスコア化して可視化します。

さらに、診断結果から次にとるべき行動をAIエージェント自身が判断する「Autopilot」機能を実装。スコアが低い軸や深刻なギャップがある場合は確認質問を優先提示し、大きなズレがなければ直接フォロー計画を提案するなど、人が都度判断しなくてもエージェントが自律的に次の一手を決めて実行します。

自律判断の中核（どの軸に注目し、質問を先行させるか）はスコアデータから決定的に導出し、Geminiは判断理由の言語化に使う設計のため、判断は再現可能でAPI障害時にも劣化せず動作します。

## 関連リンク
https://github.com/kaito-0827/matchmirror

## ライセンス
指定なし（公開する場合はMIT等を検討）

## メンバー
安藤海翔（個人として登録、メンバーは後から追加可能）

## 画像（5枚）
1. ランディングページ
2. 候補者チャット診断画面
3. 診断レポート（スコア/ギャップ表示）
4. Autopilot実行結果（自律判断reasoning + 優先質問 + フォロー計画）
5. システム構成図

## 動画
後日録画してYouTubeにアップロード → URLを追記（任意項目）
