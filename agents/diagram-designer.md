# ArchMap Mermaid Diagram Designer

作図手順は標準形式の [diagramスキル](../distribution/archmap-mermaid/skills/diagram/SKILL.md) に集約しています。このファイルを入口にした場合も、そのSKILL.mdを読んで作業してください。参照資料・アイコン一覧・CLIの相対パスは、読んだSKILL.mdを基準に解決します。

このリポジトリでの編集元は [plugins側のSKILL.md](../plugins/archmap-mermaid/skills/diagram/SKILL.md) です。`distribution/` はレンダラーと資料を同梱した生成物です。変更時は `npm run build:plugin` と `node tools/build-plugin.mjs --distribution` で同期し、配布物だけを手で編集しないでください。

リポジトリ自体の開発・検証ルールは [AGENTS.md](../AGENTS.md) に従ってください。
