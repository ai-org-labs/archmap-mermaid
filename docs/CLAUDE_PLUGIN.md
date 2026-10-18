# Claude Code plugin

ArchMap MermaidをClaude Codeから利用できます。Codex版と同じレンダラー・アイコン・作図ガイドを同梱したプラグインです。単体Skillのインストールは不要です。

## インストール

Claude Codeのターミナルで実行します。

```sh
claude plugin marketplace add ai-org-labs/archmap-mermaid
claude plugin install archmap-mermaid@archmap --scope user
```

インストール後はClaude Codeを再起動してください。userスコープでは、そのユーザーの各プロジェクトで利用できます。プロジェクトのファイルへのアクセスやコマンド実行はClaude Codeの許可設定に従います。

```text
/archmap-mermaid:diagram このプロジェクトのシステム構成図を作って
/archmap-mermaid:diagram ユーザー操作から処理完了までをシーケンス図にして
/archmap-mermaid:diagram このMermaidを見やすく配置してSVGとPNGにして
```

プロジェクト未指定なら「画面・API・データベースのWebアプリ構成図を作って」とサンプルから始められます。

## 実行要件

- Node.js 22.12以上。初回のみnpmから実行依存を取得します。
- Chromiumやレンダラー用APIキーは不要です。Claude Code自体の利用契約・認証は別途必要です。
- Mermaid、SVG、PNG、HTMLプレビューをローカルに保存します。
- 外部画像URLは取得しません。画像は対応する埋め込み形式を使います。
- Claude.aiの通常チャットやモバイルへ、このローカルプラグインが自動追加されるわけではありません。

## 更新

```sh
claude plugin marketplace update archmap
claude plugin update archmap-mermaid@archmap
```

## 開発時の確認

```sh
npm run build:plugin
claude plugin validate plugin-dist/plugins/archmap-mermaid
claude --plugin-dir ./plugin-dist/plugins/archmap-mermaid
```

同梱の作図手順は共通です。サービスごとの設計ルールのコピーを増やしません。配布先はai-org-labsのGitHub marketplaceであり、Anthropic公式ディレクトリへの掲載とは別です。

[Claude Code公式プラグイン仕様](https://code.claude.com/docs/en/plugins-reference)

## 開発と一緒に図を維持する

「このプロジェクトでは開発に合わせて設計図も更新して」と依頼すると、対象図・保存先と継続更新の方針をプロジェクトに記録します。以後は関連する設計・実装変更の節目で更新します。「継続更新を止めて」で停止できます。常時監視や毎ターンの自動実行を保証する機能ではありません。

[開始・停止・引き継ぎの手順](DIAGRAM_MAINTENANCE.md)
