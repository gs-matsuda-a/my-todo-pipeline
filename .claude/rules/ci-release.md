# CI / Release / 依存監査の方針

GitHub Actions と GitHub Security を**いつ・どこまで**入れるかの判断基準。

## ★ 自動生成しない（必読）
`.github/workflows/*.yml`・`dependabot.yml`・`codeql.yml`・`SECURITY.md` は、
**ユーザーの明示的な Yes を得る前に生成・変更しない**。要件定義や README に「CI前提」と
書いてあっても、それは確認の代替にはならない（課金・公開範囲・GHAS 契約に関わるため）。

## 判断フロー
```
Prereq: リポジトリ visibility は? （Public / Private）
Step 0: CI をやるか?            （No も妥当。個人実験・docsのみ等は不要）
Step 1: CI matrix は?           （Linux のみ=既定 / +Windows / +macOS）
Step 2: Release をやるか?
Step 3: Release targets は?
Step 4: GitHub Security 各項目を個別に Yes/No
```

## コスト感（2026 時点・GitHub Actions）
| OS | 単価 | 備考 |
|----|------|------|
| Linux | $0.006/min | 最安・既定 |
| Windows | $0.010/min | 受容範囲 |
| macOS | **$0.062/min（10x）** | PR毎は高額。tag時のみ等に限定 |

- **既定は Linux のみ**。macOS を PR matrix に入れるのは明確な理由がある時だけ。
- CI（PR毎の検証）と Release（配布物作成）はコストも頻度も別物として判断する。

## 依存監査（言語非依存・4観点）
licenses / advisories / bans / sources を継続監査する。まず Dependabot alerts を有効化し、
商用配布が射程に入ったら言語別ツール（`npm audit`・`pip-audit`・`cargo deny`・`govulncheck` 等）
や言語横断ツール（OSV-Scanner・Trivy）を CI に追加する。

## テンプレ
- 最小 CI: `../../.github/workflows/ci.yml`（Node 既定。他言語は steps を差し替え）
- CD（任意）: Render 等へは `render.yaml`（Blueprint）を repo に置き、Render に接続して push 自動デプロイ（クレカ不要の無料枠あり。Node はネイティブビルドで Dockerfile 不要）。worked example は本コース `chapters/07_delivery_pipeline/`
- 依存更新: `../../.github/dependabot.yml`（`package-ecosystem` を言語に合わせる）
- CodeQL/Release が必要な場合は、確認後にこのファイルの方針で追加する。
