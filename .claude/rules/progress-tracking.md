# 進捗追記 & セッション復旧

## 原則
トークン切れで会話が途切れても、**Issue コメントから続きを再開できる**ようにする。
各 Phase 完了時・実装の区切りごとに、対象 Issue へコンパクトなチェックポイントを追記する。

## チェックポイント形式
HTML コメントにメタデータ、本文は4行以内。`<!-- CLAUDE_PROGRESS -->` で機械検出可能にする。
```markdown
<!-- CLAUDE_PROGRESS phase=2 status=IN_PROGRESS branch=feat/#42-pagination -->
completed: 1 | current: 2 | next: Phase 2 実装
files: src/types.ts, src/api/search.ts
context: offset/limit方式, 認証は別Issueに分離
```
| フィールド | 内容 |
|-----------|------|
| `phase` / `status` / `branch` | Phase番号 / COMPLETED·IN_PROGRESS / ブランチ名 |
| `completed` / `next` | 完了済みPhase / 次のアクション |
| `files` / `context` | 変更ファイル / 技術判断・ユーザー指示の要約 |

## 追記タイミング
| タイミング | 内容 |
|-----------|------|
| Phase 1 完了 | 計画概要・ブランチ名 |
| Phase 2 区切り | 完了ステップ・ファイル・テスト結果 |
| Phase 3 完了 | レビュー結果（PASS/FAIL） |
| Phase 4 完了 | PR URL |

## 再開検出
`/issue-flow #N` 実行時に最新の `CLAUDE_PROGRESS` を読み、完了済み Phase をスキップして中断地点から再開する。

## 注意
- 追記のみ（過去コメントを編集・削除しない）/ 最新を参照
- **機密情報を含めない**
