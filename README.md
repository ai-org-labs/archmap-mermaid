# ArchMap Mermaid

Mermaid記法を、ArchMapの配置・配線・SVGレンダラーで描く独立したプロジェクトです。
公式Mermaid 12.0.0のパーサーを利用し、MermaidのSVGレンダラーは呼び出しません。
元の [ArchMap](https://github.com/ai-org-labs/archmap) は別プロジェクトとして維持します。

- [Playground](https://ai-org-labs.github.io/archmap-mermaid/playground/)
- [構文・対応範囲・AIプロンプト・アイコン一覧](https://ai-org-labs.github.io/archmap-mermaid/syntax/)
- [Examples](https://ai-org-labs.github.io/archmap-mermaid/examples/)

## 機能

システム構成・レイヤースタック・シーケンス・画面遷移・アクティビティの5種類。
入力は flowchart / graph / sequenceDiagram / stateDiagram-v2 の対応サブセットです。
独自DSLは採用せず、必要な表示設定だけ `%% archmap: JSON` コメントに記述します。
互換範囲は [docs/SYNTAX.md](docs/SYNTAX.md) に列挙しています。

エディタ折りたたみ、パン、カーソル中心ズーム、Fit、SVG / PNG / .mmd書き出し、
ローカル下書き、AI用プロンプト、検索可能なアイコン一覧と全件テキスト保存を搭載。
オンライン版もブラウザー内だけで処理します。GitHub Pagesは静的ファイル配信です。
オフライン版はパーサー・アイコン・ドキュメントを含む単一HTMLです。

## 開発

Node.js 22.12以上。`npm ci` の後、`npm run dev`。
`npm run verify` で型チェック、変換テスト、Pages / オフライン版 / ブラウザーAPIのビルドを実行します。
GitHub ActionsはmainへのpushでGitHub Pagesに公開します。

## ブラウザーAPI

`npm run build:library` が `dist/archmap-mermaid.js` を生成します。npm公開はしていません。

```js
import { renderMermaid } from './dist/archmap-mermaid.js';
const result = await renderMermaid('flowchart LR\nA[Web] --> B[API]');
document.querySelector('#diagram').innerHTML = result.svg;
```

DOMのあるブラウザー向けです。解析は公式Mermaidの状態を共有するため直列化しています。
MermaidパーサーのデータベースAPIに依存する箇所は `src/focused/parser.ts` に隔離し、
バージョンを固定しています。アップグレード時は変換テストとブラウザー確認を実施します。

## ライセンス

Apache-2.0。描画エンジン・サイトの基盤はArchMapから派生しています。
Mermaidほかの依存・アイコンの帰属は `THIRD_PARTY_NOTICES.md` を参照してください。
