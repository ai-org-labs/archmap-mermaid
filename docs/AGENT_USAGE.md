# 図作成エージェントの使い方

自然言語や既存 `.mmd` から、ArchMap Mermaidで描ける図を作成・修正するリポジトリ内のエージェントです。LLMサービスへの自動接続やChatGPTプラグインのインストールを行うものではありません。

## Codexなどのリポジトリエージェント

このリポジトリを作業対象にして、以下のように依頼します。[AGENTS.md](../AGENTS.md)が図作成の手順への入口です。

> agents/diagram-designer.mdに従って、注文API、在庫サービス、決済サービス、通知ワーカーのシステム構成図を作って。同期と非同期の接続を区別し、docs/diagrams/order-system.mmdに保存して描画も確認して。

> このactivity.mmdをレビューして。条件分岐と並列処理の意味を保ったまま、線の重なりや遠回りを減らして。

## GitHub Copilot / VS Code

このリポジトリを開き、カスタムエージェント `archmap-designer` を選んで図の目的を伝えます。定義は [.github/agents/archmap-designer.agent.md](https://github.com/ai-org-labs/archmap-mermaid/blob/main/.github/agents/archmap-designer.agent.md) です。

環境がカスタムエージェントを読み込まない場合は、[agents/diagram-designer.md](../agents/diagram-designer.md)を読んで作業するよう直接依頼できます。

形式の根拠：[GitHub公式カスタムエージェント設定](https://docs.github.com/en/copilot/reference/custom-agents-configuration)。

## 別プロジェクトで使う

このリポジトリを参照できる環境なら `agents/diagram-designer.md` の実際の場所を指定して読み込ませます。コピーして使う場合は次のファイルを相対配置のままコピーし、利用先の既存 `AGENTS.md` に参照を追加してください。既存の指示を上書きしないでください。

- `agents/diagram-designer.md`
- `docs/SYNTAX.md`
- `docs/DIAGRAM_LAYOUT_GUIDE.md`
- `docs/AI_PROMPT_TEMPLATE.md`
- 必要なら `.github/agents/archmap-designer.agent.md` と、その参照先の入口

描画実行にはArchMap Mermaid本体かPlaygroundが別途必要です。コピーした仕様は自動更新されません。元リポジトリの更新時に同期してください。

## チャットだけで使う

[構文ページ](https://ai-org-labs.github.io/archmap-mermaid/syntax/)のAI用プロンプトをコピーし、要件と一緒に渡します。ファイルを扱える環境では上記のエージェント手順と参照資料も渡せます。チャットで生成したコードはPlaygroundに貼り付けて描画を確認してください。

## 成果物と確認

編集可能な `.mmd` が正本です。必要に応じてSVG / PNGも生成します。エージェントは構文・警告だけでなく、線の重なりや不要な折れ曲がり、文字切れも確認します。ブラウザーを利用できなければ描画未確認と報告します。

配置の判断は [ArchMapの配置ガイド](DIAGRAM_LAYOUT_GUIDE.md) にまとめています。自動配置から始め、方向・グループ・ラベル・必要最小限の配置補助の順に調整し、描画で比較します。

## 作例とレビュー

[3種類の作例](diagrams/agent-examples/index.html)で、ソース・SVG・PNGとレンダラー改善後のレビューを確認できます。
