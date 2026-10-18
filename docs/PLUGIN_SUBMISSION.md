# Plugin directory submission

## 配布物

```sh
npm run verify
node tools/build-plugin.mjs --distribution
npm run test:plugin
```

OpenAI申請用: `plugin-dist/archmap-mermaid-plugin-0.1.3.zip`。ZIP直下にportable `plugin.json`を置き、ローカル実行を必要とするプラグインとして`requires_local_executor: true`を宣言しています。同梱Skillはプラグインの実行手順であり、独立したSkill配布は行いません。

## 公開手順

1. [OpenAI申請ポータル](https://platform.openai.com/plugins)でZIPをアップロード。
2. 自動検査の指摘を解決。
3. 開発者本人が開発者情報・必要な本人確認・規約を確認し、レビューを申請。
4. 承認後に公開。GitHub Release公開のみでは公式ディレクトリ掲載になりません。

## レビュー用確認例

- 「画面・API・データベースのWebアプリ構成図を作って」→ プロジェクトを仮定せずサンプルのMermaid/SVG/PNGを生成。
- 「ログイン操作から認証完了までのシーケンス図を作って」→ シーケンス図を生成。
- 「AWS LambdaとDynamoDBで構成図を作って」→ 同梱アイコンを検索し使用。
- 既存Mermaidの構文エラー → エラーを報告し既存成果物を破壊しない。
- 作図に関係ない依頼 → このプラグインを呼び出さない。

初回npm依存取得以外、レンダラーはローカル実行です。図の内容は外部レンダリングサービスへ送信しません。ホストAIサービスへの入力はそのサービスの設定・規約に従います。

[OpenAI公式申請ガイド](https://developers.openai.com/plugins/deploy/submission)

Claude Codeの配布・導入は[CLAUDE_PLUGIN.md](CLAUDE_PLUGIN.md)を参照してください。

## 現在の申請状況（2026-10-18）

申請ポータルで開発者本人確認が未完了のため、ZIPアップロード前で停止しています。公式ディレクトリへの申請・掲載はまだ完了していません。GitHub配布は利用できます。
