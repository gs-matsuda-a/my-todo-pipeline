# Git / GitHub ワークフロー

## 基本原則
**1 Issue = 1 ブランチ = 1 PR**

## ブランチ命名
```
<type>/#<issue番号>-<短い説明>
例: feat/#123-add-user-auth, fix/#456-login-error
```
| ラベル | プレフィックス |
|--------|--------------|
| enhancement / feature | `feat/` |
| bug | `fix/` |
| documentation | `docs/` |
| refactor | `refactor/` |

## コミットメッセージ
```
<type>(#<issue>): <説明>
例: feat(#123): ユーザー認証機能を追加
```
type: `feat` / `fix` / `docs` / `test` / `refactor` / `perf` / `chore` / `ci`

## PR
- タイトル: `<type>(#<issue>): <説明>`（70文字以内）
- 本文に **`Closes #<issue>`** を含める（マージで Issue 自動クローズ）
- テストプランを記載する
- マージ戦略: **Squash merge** 推奨（`gh pr merge <N> --squash`）

## 禁止
- `git push --force` は使わない
- 機密情報をコミット・PR 本文に含めない
