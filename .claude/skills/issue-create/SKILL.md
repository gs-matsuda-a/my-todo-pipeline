---
name: issue-create
description: 既存Issueの重複を確認し、必要なら新規Issueを作成する。空リポジトリなら技術スタック提案→雛形生成→初期コミットまで行ってからIssue化する。作成後は /issue-flow で開発を開始できる。
argument-hint: "<要件の説明 or 要件定義ファイルのパス>"
---

# Issue Create スキル

要件を受け取り、**重複確認 →（新規PJなら土台づくり）→ Issue 作成** までを行う。
引数は必須。空なら使い方を案内して中断する。

## スコープガード（実装はしない）

本スキルの責務は **Issue 化まで**。引数に「実装して」「動く状態まで持って行って」等の
実装指示が含まれていても、本スキル中には機能実装を行わない。その指示は Issue の
受け入れ条件に転記し、実装は `/issue-flow` に委ねる（Issue 作成完了時にその旨を案内する）。
ここで実装すると TDD・レビューのゲートを素通りしたコードが初期コミットに入り、
以降のフロー全体が形骸化するため。

## 使い方
```
/issue-create 検索にページネーションを追加
/issue-create ログイン時に500エラーが出る
/issue-create docs/requirements.md この要件でアプリを作りたい
```

## 書き込み前ゲート（plan モード）
重複確認・設計・技術調査など**書き込みが発生する前の全工程を plan モードで実行**し、
`ExitPlanMode` の承認まで Edit/Write をブロックする。特に `.github/**`（CI/Release/Security）は
`rules/ci-release.md` の方針どおり **承認前に絶対に生成しない**。ExitPlanMode は
「最後の書き込み直前の承認」を1回だけ行い、途中の確認は `AskUserQuestion` で plan モード内に出す。

## フロー
```
引数チェック → EnterPlanMode
  │
Phase 0: 事前チェック（3つを並列・すべて read-only）
  ├─ GitHub連携: git remote -v / gh auth status
  ├─ PJ状態:    定義ファイル(package.json 等)の有無で 新規/既存 を判定 + CLAUDE.md の文脈取得
  └─ 重複確認:  gh issue list --search "<keyword> is:open"
  │
  ├─ GitHub NG → 中断（remote 追加 / gh auth login を案内）
  ├─ 重複あり  → 該当Issueを提示し判断を委ねる
  ├─ 新規PJ    → Phase 1（土台づくり）→ Phase 2
  └─ 既存PJ    → Phase 2（Issue作成）
```

## Phase 1: 新規プロジェクトの土台づくり
1. **要件分析**: 引数から機能/非機能要件・設計方針を抽出してユーザーに提示。
2. **技術スタック提案**: WebSearch で最新ベストプラクティスを調べ、**1つの具体的なスタック**を理由つきで提案する。
3. **CI/Release/Security を1つずつ確認（必須）**: visibility(Public/Private)・CI 有無・Release 有無・Dependabot・CodeQL 等を
   `rules/ci-release.md` / `rules/security.md` の基準で**個別に確認**する。暗黙のデフォルト（「迷ったら全部 Yes」）は置かない。
4. **ExitPlanMode で生成物一覧（特に `.github/**`）と確定スタックを承認**してもらう。
5. 承認後に雛形生成 → 初期コミット/プッシュ → 「使う」と答えた Security 機能のみ `gh api` で有効化。
   - 雛形は**起動する最小限の土台**まで（要件の機能実装はスコープガードどおり含めない）。
   - 雛形に書く依存は **生成前に最新版を取得**して書く（古い版だと Dependabot が直後に PR を量産するため）。

## Phase 2: スコープ判定 → Issue 作成
**小スコープ**（単一機能・バグ修正）:
- タイトル / ラベル / 本文（概要・背景・受け入れ条件・技術メモ）を生成。
- `ExitPlanMode` で承認 → `gh issue create --title ... --label ... --body ...`。

**大スコープ**（要件定義ファイル / 複数機能領域 / Phase 分け / 30行超）:
1. 要件を **機能・データモデル・非機能要件** の粒度まで列挙する。
   API 仕様書が入力にある場合は、**仕様書からの契約テスト整備を最初の Issue の受け入れ条件に含める**
   （`rules/verification.md`。以降の全 Issue はこの契約テストを green に保つ）。
2. 1 Issue = 独立してデプロイ可能な単位（受け入れ条件 3〜10個）に分解。DB→API→画面 の依存順で。
3. **トレーサビリティ表（必須）**: 「要件 → Issue」の対応表を作り、全要件が Issue に載っているか目視確認する。
   入力が要件の一部なら、既存コード・既存 Issue とも突合して未カバーを洗い出す。
4. `ExitPlanMode` で表を承認 → **依存レベル単位で並列に** `gh issue create`（同レベルは1メッセージで同時発行）。
   GitHub は到達順に番号を振るため、依存参照は番号確定後に埋め、完了後に実番号で一覧表示する。

## ラベル自動判定
| 表現 | ラベル |
|------|--------|
| 追加・新機能・〜したい | `enhancement` |
| エラー・バグ・動かない | `bug` |
| ドキュメント・README | `documentation` |
| リファクタ・整理 | `refactor` |
| テスト追加 | `test` |
| 遅い・パフォーマンス | `performance` |

## 連携
- 作成後 → `/issue-flow #N` で 分析+計画 → TDD実装 → レビュー → デリバリー へ。
- 規約は `rules/git-workflow.md`（ブランチ/PR）・`rules/ci-release.md`（`.github/**`）・`rules/security.md` を参照。
