# ProtoPedia 提出内容（DevOps × AI Agent Hackathon 2026）

締切: **2026年7月10日(金) 23:59**

提出フロー（要項確認済み・2026-07-06時点）:
1. ProtoPediaにアカウント作成 → 本ドキュメントの内容で作品登録
2. Findyの作品提出フォーム（Google Form）に下記3点を提出して正式エントリー完了
   - GitHubリポジトリURL（公開）: https://github.com/kaito-0827/matchmirror
   - デプロイURL（動作確認可能な状態）: https://matchmirror.vercel.app
   - ProtoPediaに登録した作品のURL

開発要件の適合: Google Cloud実行プロダクト = **Cloud Run** / Google Cloud AI技術 = **Gemini API** — 両方の必須要件を満たす。

## 作品ステータス
開発中（デプロイ済み・継続改善中）

## 作品タイトル
MatchMirror — AIエージェントが入社後ギャップを自律的に診断・フォローする採用ミスマッチ防止サービス

## 概要
求人票と入社後の実態のズレ（早期離職の最大要因）を、AIエージェントが企業実態ヒアリングと候補者チャット診断から自動で可視化。さらに自律判断エージェント（OrchestratorAgent）がギャップの深刻度から「確認質問を先にすべきか」「フォロー計画を直接作るべきか」を自分で判断し、優先質問の出し分け→入社前後のフォロー計画生成まで一気通貫で実行します。診断中は「Agent Console」が各エージェントの実際の実行状態（照合→質問生成・ガードレール検査の並列実行→保存）をリアルタイム表示し、AIの働きを透明化します。

## 作品のURL
https://matchmirror.vercel.app

## システム構成（テキスト補足）
Vercel(React/TypeScript) → Cloud Run(FastAPI) → 診断エージェント群がスコア/ギャップを算出 → OrchestratorAgentが自律判断 → FollowUpAgentがフォロー計画を生成。バックエンドはGemini API・Cloud Firestore・Firebase Authenticationと連携。エージェントの実行状態はFirestoreの進捗ドキュメントを介してフロントにリアルタイム反映（Agent Console）。
（画像: docs/assets/architecture.png をアップロード — システムアーキテクチャ図のアップロードは必須）

## 開発素材（必須）
Gemini API / Cloud Run / Cloud Firestore / Firebase Authentication / GitHub Actions (Workload Identity Federationによる CI/CD) / React / TypeScript / Vite / FastAPI / Python

## タグ（必須）
**findy_hackathon**（ハッカソン指定の必須タグ・忘れずに）, React, TypeScript, FastAPI, Python, Vite, HRTech, AIエージェント, 採用ミスマッチ, GeminiAPI, CloudRun

## ストーリー（必須: ①課題と背景 ②想定ユーザー ③プロダクトの特徴）

### ①本作品で解決したい課題とその背景
新卒・中途の早期離職の多くは「求人票と現場のギャップ」が原因です。働き方・OJT・文化などの実態は面接の限られた時間では確認しきれず、確認漏れがそのまま入社後のミスマッチになります。

### ②想定する利用ユーザー
就職・転職活動中の候補者（新卒・中途）と、採用ミスマッチによる早期離職を減らしたい企業の人事担当者の双方。

### ③プロダクトの特徴
MatchMirrorは、企業側には実際の業務・OJT・休暇実態などをヒアリングし、候補者側にはチャット形式で価値観・働き方の希望を診断、両者のズレを6軸でスコア化して根拠付きで可視化します。

診断結果から次にとるべき行動をAIエージェント自身が判断する「Autopilot」を実装。スコアが低い軸や深刻なギャップがある場合は確認質問を優先提示し、大きなズレがなければ直接フォロー計画を提案するなど、人が都度判断しなくてもエージェントが自律的に次の一手を決めて実行します。

自律判断の中核（どの軸に注目し、質問を先行させるか）はスコアデータから決定的に導出し、Geminiは判断理由の言語化に使う設計のため、判断は再現可能でAPI障害時にも劣化せず動作します。

診断実行中は「Agent Console」が9体のエージェントのうち実際に動いているものの実行状態をリアルタイムで表示。MismatchAgentの照合、QuestionAgent・GuardrailAgentの並列実行までを可視化し、AIの判断過程を透明にしています（表示は演出ではなくバックエンドの実実行状態）。また、MismatchAgentの全出力はGuardrailAgentが差別性・断定表現を検査してから表示される、採用領域に不可欠な安全設計です。

## 関連リンク
https://github.com/kaito-0827/matchmirror

## ライセンス
指定なし（公開する場合はMIT等を検討）

## メンバー
安藤海翔（個人として登録、メンバーは後から追加可能）

## 画像（任意・最大5枚）
1. ランディングページ（01-landing.png）
2. 候補者チャット診断画面（03-chat.png）
3. 診断レポート＋Agent Console（要撮り直し: Agent Console実装後のUI）
4. Autopilot実行結果（要撮り直し: 自律判断reasoning + 優先質問 + フォロー計画）
5. システム構成図（architecture.png）

## 動画（**必須** — YouTube もしくは Vimeo のURL）
⚠️ 要項では動画は**必須**（以前の本メモの「任意」は誤り）。
docs/demo-video-script.md の絵コンテで録画 → YouTubeに限定公開でアップロード → URLをProtoPediaの動画欄に入力。
