# ArchMap Mermaid agents

## 図の作成・修正を依頼されたとき

[図作成エージェント](agents/diagram-designer.md)を読み、そこから参照する構文仕様に従って作業する。要件や既存コードから編集可能な `.mmd` を作り、ArchMapで描画を確認する。

## このリポジトリ自体を開発するとき

[README](README.md)と変更対象の実装・テストを読む。図作成の依頼とレンダラー開発を区別し、図の編集だけで済む依頼でエンジンを変更しない。

構文の正本は [docs/SYNTAX.md](docs/SYNTAX.md)。構文対応を変える場合は仕様と関連テストを更新する。基本プロンプトは [docs/AI_PROMPT_TEMPLATE.md](docs/AI_PROMPT_TEMPLATE.md)。仕様をアダプタへ複製しない。

実装を変更したら `npm run verify` を実行する。描画・操作を変更したらブラウザーでも確認する。未実施の検証を実施済みと報告しない。
