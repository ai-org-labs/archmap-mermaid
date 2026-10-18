# ArchMap Mermaid Codex plugin

ローカルのCodexから、ソースを読み設計図を作成・更新し、SVG / PNG / HTMLプレビューを生成するスキル型プラグイン。APIキーやMCPサーバーは不要。自動監視ではなく、依頼・開発の節目でスキルを使用する。

## 配布物の作成

```sh
npm ci
npm run build:plugin
npm run test:plugin
```

`plugin-dist/plugins/archmap-mermaid/` が自己完結したプラグイン本体。
`plugin-dist/archmap-mermaid-plugin-0.1.1.tgz` が配布用アーカイブ。
`plugin-dist/.agents/plugins/marketplace.json` がローカル検証用カタログ。
ソースの `plugins/` は開発用で、レンダラーと構文ガイドはビルド時に同梱する。開発用ディレクトリだけを配布しない。

現行のブラウザーESM、アイコン、帰属情報を同梱する。構文・配置ガイドは正本からコピーされ、プラグイン側で別仕様を維持しない。既存npm版の更新やCDNに依存せず、ビルドしたコードで描画する。

## 実行環境

Node.js 22.12以上が必要。初回に同梱の `runtime/setup.mjs` がロックファイルに従ってjsdom・resvg・画像サイズ解析用の依存をインストールする。Chromiumは不要。セットアップはnpm配布元へ通信するが、描画では外部リソースを読み込まない。SVGはNode.js＋jsdomで生成し、PNGはresvgで変換する。

依存はプラグインのruntime配下に入り、利用者のプロジェクトのpackage.jsonを変更しない。ブラウザーのダウンロードやキャッシュは作らない。アプリの権限設定に従って実行する。

## 動作確認

```sh
node /absolute/path/to/plugin/runtime/setup.mjs
node /absolute/path/to/plugin/runtime/cli.mjs doctor
node /absolute/path/to/plugin/runtime/cli.mjs icons server
node /absolute/path/to/plugin/runtime/cli.mjs render docs/diagrams/system.mmd --out docs/diagrams/system
```

SVG・HTML・診断JSONを出力。PNGも必要なら `--png` を指定する。既存PNGの更新時も `--png` が必要。既存ファイルの更新は `--force` を明示する。構文エラーの場合は既存出力を保持する。PNGは最大2倍、長辺8192pxまで。埋め込み画像はPNG / JPEG / GIFのbase64 data URIに対応（16メガピクセルまで）。URL・WebP・SVG画像はこのNode版では明示的にエラーとする。PNGのフォントは端末のフォントを使用するため、日本語フォントが必要で、ブラウザーとの完全なピクセル一致は保証しない。

スキルは利用可能なCodexファイルプレビューで図を開く。プレビューAPIのない環境ではファイルリンクを返す。

## インストール

Node.js 22.12以上とCodex CLIを用意して、次を実行する。利用者によるレンダラーのビルドは不要。

```sh
codex plugin marketplace add ai-org-labs/archmap-mermaid --ref v0.1.7
codex plugin add archmap-mermaid@archmap
```

Codexを新しい会話で開き、例えば「ArchMap Mermaidで、このプロジェクトの構成図をアイコン付きで作って」と依頼する。初回はスキルが同梱setupを実行して必要なnpm依存を準備する。APIキーとChromiumは不要。

プラグイン名は `archmap-mermaid`、スキル名は `diagram`。自動選択されなければ明示的にArchMap Mermaidを指定する。実行権限はCodexの設定に従う。

公開カタログは `.agents/plugins/marketplace.json`、インストール対象はビルド済みの `distribution/archmap-mermaid/`。開発元は `plugins/archmap-mermaid/`。リリース時に `npm run build:plugin` の後 `node tools/build-plugin.mjs --distribution` で同期する。distribution内を直接編集しない。

更新は新しいリリースタグを指定してカタログを登録し、プラグインを再導入する。ローカル検証は `codex plugin marketplace add /absolute/path/to/archmap-mermaid` で同じカタログを登録できる。

GitHub Releaseにもプラグインのアーカイブを添付する。これはGitHub経由の配布で、OpenAIの公開プラグインディレクトリへの掲載とは別。形式は [OpenAIのプラグイン仕様](https://developers.openai.com/plugins/build/plugins) に従う。

## テスト

`test:plugin` は配布物を別の一時ディレクトリ（空白を含むパス）へコピーし、依存を初期化して8図種のSVG / PNG / HTMLを生成する。アイコン検索、PNG寸法、上書き保護、不正入力時の既存出力維持、更新、外部画像の拒否も検証する。配布元のnode_modulesやソースを実行時に参照しない。

## ArchMap Icons

`@archmap/icons` はブラウザーESMに同梱済み。追加の認証・サービス接続は不要。
`icons aws` / `icons cloud_run` / `icons github` で実在するキーを検索し、標準icon属性または既存のArchMap表示コメントに指定する。スキルにも検索→選択→描画確認の手順を含める。クラウド技術が未確定なら汎用アイコンを使う。

PNG変換では `auto-start-reverse` の互換差を避けるため、線の各端点の方向からマーカー角度を明示する。配布するSVGは元の標準SVGを保持する。

## 紹介画面と試し方

専用の透過フクロウアイコンと日本語の説明を同梱しています。紹介画面には、対象リポジトリがなくても試せる依頼例を3つ設定しています。

- Webアプリの構成図を、画面・API・データベースで作って
- ログイン操作から認証完了までのシーケンス図を作って
- MermaidをSVG・PNGにしたい。コードを貼るので見やすく整えて

[プレイグラウンド](https://ai-org-labs.github.io/archmap-mermaid/playground/)では、インストールせずにサンプルを選んで描画・書き出しを試せます。[サンプル一覧](https://ai-org-labs.github.io/archmap-mermaid/examples/)も参照できます。スキル型プラグインの紹介用スクリーンショット設定は追加していません。

個人環境へインストールすれば、各プロジェクトの会話から利用できます。対象は現在の作業ディレクトリや明示したファイルで判断します。不明な場合は対象を確認し、無関係なリポジトリを推測して変更しません。別端末では別途インストールとNode.jsの準備が必要です。

### アイコンや説明が古い場合

キャッシュを直接書き換えるのではなく、新しいタグのカタログを取得して再導入します。旧タグで登録済みの場合は、先にカタログ登録を外してください（作成した図やプロジェクトは削除されません）。

```sh
codex plugin marketplace remove archmap
codex plugin marketplace add ai-org-labs/archmap-mermaid --ref v0.1.7
codex plugin add archmap-mermaid@archmap
```

`codex plugin list`で`installed, enabled`とバージョン`0.1.1`を確認してください。アプリの既存画面が更新されない場合は画面を開き直し、それでも古ければアプリを再起動してください。
