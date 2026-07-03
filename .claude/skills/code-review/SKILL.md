---
name: code-review
description: 複数のレビュー専門サブエージェントを並列実行し、品質・セキュリティ・テストを同時に検証する。
---

# Code Review スキル

レビューを役割ごとに分け、**並列実行**して短時間で多角的に検証する。

## 使い方
```
/code-review
```

## 並列レビュー
変更ファイルリスト（`git diff --name-only main...HEAD`）を全エージェントに渡し、同時に起動する:

| エージェント | 観点 | モデル | 条件 |
|-------------|------|--------|------|
| code-quality-reviewer | 品質・構造・命名 | sonnet | 常時 |
| security-reviewer | 脆弱性・シークレット | sonnet | 常時 |
| test-verifier | テスト・カバレッジ80% | haiku | 常時 |

> haiku/sonnet を使い分けて精度とコストを両立する。DB 変更やUI変更がある場合は、該当する専門エージェントを追加してよい。

## 統合判定
各エージェントの末尾要約を集約する。

- 全て PASS/SECURE → ユーザー確認の上、次へ（コミット/PR）。
- いずれか FAIL/VULNERABLE → 指摘を severity 順（CRITICAL→HIGH→MEDIUM）に提示し、「修正して再レビュー / 一部許容して進む」をユーザーに選ばせる。

## 連携
- `/issue-flow` の Phase 3 から呼ばれる。単独でも使える。
