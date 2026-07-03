---
name: issue-flow
description: GitHub Issue を起点に、分析+計画 → TDD実装 → 並列レビュー → デリバリーの4フェーズで開発する。各Phaseで進捗をIssueに追記し、中断しても再開できる。
---

# Issue Flow スキル

GitHub Issue を単一の起点（source of truth）として、サブエージェントの並列実行で開発する。

## 使い方
```
/issue-flow #42          # 単一 Issue
/issue-flow              # Issue 一覧から選択
/issue-flow #41 #42 #43  # 複数 Issue を git worktree で並列
```

## 4フェーズ
```
Phase 0 再開検出   Issueコメントの <!-- CLAUDE_PROGRESS --> を確認し、完了済みをスキップ
Phase 1 分析+計画  issue-analyzer / Explore / planner を3並列 → /plan の計画提示
                   ▼ ユーザー確認①「この方針で実装してよいか」
Phase 2 実装       /tdd で RED→GREEN→REFACTOR（依存グラフのレベル単位で並列可）
Phase 3 レビュー   /code-review（品質・セキュリティ・テストを並列）
Phase 3.5 実証     アプリを実際に起動し、主要フローを HTTP で1往復＋全テスト＋（仕様書があれば）契約テスト。
                   NG なら Phase 2 に戻る。green になるまで PR 禁止（rules/verification.md）
                   ▼ ユーザー確認②「コミット・PR作成してよいか」
Phase 4 デリバリー doc更新 → git commit → pr-creator（push + PR, Closes #N。テストプランに実証結果を記載）
```
各 Phase 完了時に Issue へチェックポイントを追記する（形式は `rules/progress-tracking.md`）。

## 複数 Issue 並列（worktree）
複数指定時は各 Issue を独立した `git worktree`（`.claude/worktrees/<branch>/`）で並列実行する。
- 既定の並列度は 5（`--parallel=N` で調整）。
- worktree は **PR マージ後**に削除。起動時（Phase 0）にマージ済みを自動掃除する。
- `.claude/worktrees/.gitignore`（`*` を無視）が必要。

## セッション復旧
トークン切れで中断しても、同じ `/issue-flow #N` を実行すれば Issue コメントの最新チェックポイントから再開する。

## 注意
- `gh auth status` が認証済みであること。
- 機密情報を Issue/PR/チェックポイントに転記しない。
- `.github/**` の生成・変更はユーザーの明示確認を得てから（`rules/ci-release.md`）。
- `git push --force` は使わない。
