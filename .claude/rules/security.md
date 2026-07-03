# セキュリティ

## コミット前チェック
- [ ] ハードコードされたシークレット（APIキー・パスワード・トークン）が無い
- [ ] すべての外部入力をバリデーション（長さ上限・空/空白のみの拒否を含む）
- [ ] SQL/コマンドインジェクション対策（パラメータ化クエリ）
- [ ] XSS 対策（出力エスケープ）/ CSRF 対策
- [ ] 認証・認可を検証 / エラーメッセージで機密を漏らさない
- [ ] パスワードは低速ハッシュで保存（下記「認証・セッションの実装既定」）
- [ ] セキュリティヘッダを付与（下記「HTTP レスポンスの既定」）

## 認証・セッションの実装既定
パスワード認証を実装するときは、以下を**要件に書かれていなくても既定**とする（OWASP 準拠）。
- **パスワード保存は低速ハッシュ**: bcrypt / argon2 / scrypt（コスト係数つき）。
  md5 / sha256 等の高速ハッシュや平文は不可（GPU 総当たりに無力なため）。
- **パスワードポリシー**: 最低長（8文字以上を目安）を検証する。
- **ログイン試行のレート制限**: 総当たり対策（例: `express-rate-limit`、またはアカウント単位の失敗回数制限）。
- **セッション管理**: ログイン成功時に ID を再発行（固定化対策）/ ログアウトでサーバ側でも無効化 /
  トークンは CSPRNG で十分な長さ。
- **Cookie 属性**: `HttpOnly` + `SameSite=Lax|Strict` を必須、本番（HTTPS）では `Secure` も必須
  （環境変数等で本番判定して付与）。
- **ユーザー名等の識別子**: 長さ上限を設け、制御文字・不可視文字（ゼロ幅・双方向制御）を拒否する。
  Unicode 正規化（NFKC 等）後の同一判定で、見た目が同じ別表記のなりすまし登録を防ぐ。

## HTTP レスポンスの既定
- セキュリティヘッダを既定で付与する: `X-Content-Type-Options: nosniff` /
  クリックジャッキング対策（CSP `frame-ancestors` または `X-Frame-Options`）/
  フレームワーク情報の隠蔽（Express なら `X-Powered-By` を無効化）。Node/Express は `helmet` 導入が最短。
- リクエストボディにサイズ上限を設ける（例: `express.json({ limit })`）。フィールド単位の長さ上限と併用する。

## シークレット管理
```
# NG: ハードコード
apiKey = "sk-xxxxx"
# OK: 環境変数から取得し、未設定なら明示エラー
apiKey = getEnv("API_KEY")  // JS: process.env / Python: os.environ / Go: os.Getenv / Rust: std::env::var
```
- `.env` はコミットしない。`.env.example` に**キー名だけ**書く。
- シークレットが混入したら、修正に加え**該当キーをローテーション**する。

## GitHub Security 機能（運用面の防御）
コード対策に加え、リポジトリ機能を**プロジェクトに応じて**有効化する。
**有効化はユーザー確認後**（公開範囲・GHAS 契約で可否と課金が変わるため）。

| 機能 | 何を防ぐか | 備考 |
|------|----------|------|
| Dependabot alerts/updates | 既知CVEを持つ依存の放置 | ほぼ常に有効化（無料） |
| `dependabot.yml` | 依存のバージョン乖離 | ecosystem に合わせ生成 |
| Secret scanning + Push protection | シークレットの混入・流入 | Public か GHAS で利用可 |
| CodeQL | SQLi/XSS 等の静的検出 | OSS / 公開エンドポイント持ち |
| Private vulnerability reporting | OSS脆弱性の公開暴露 | OSS のみ。`SECURITY.md` とセット |

設定の判断基準・YAML テンプレは `ci-release.md` を参照。
