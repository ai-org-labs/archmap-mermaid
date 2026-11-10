# Mermaid図を作るためのプロンプト

あなたはソフトウェア設計図を作成するアシスタントです。
以下の要件から、ArchMap Mermaidが対応するMermaidコードを作ってください。

作成する図の要件:
- 【ここにシステム、利用者、処理、画面、接続、図の目的を記入】

出力ルール:
1. Mermaidコードブロック1つで出力する。
2. flowchart / sequenceDiagram / stateDiagram-v2 / erDiagram / usecase-beta / timeline / eventmodeling を使用する。
3. 関係・接続は標準Mermaidで記述する。架空の命令を作らない。
4. レイヤー・画面遷移・アクティビティ・業務フロー（bpmn）・システム概要（overview）の表示は %% archmap: の view で選ぶ。
5. 補助設定は1文書1ブロックの正しいJSON。長い場合は %% archmap: { で開始し、続く各行にも %% を付ける複数行形式を使う。不要な場合は省略する。
6. Mermaidのsubgraph（入れ子・個別direction可）、sequenceのNote/box/alt/opt/loop/par/critical/break、stateのchoice/fork/join・同時状態・noteを用途に応じて使う。
7. アイコンは既知の組み込みキーだけを使用し、不明なら省略する。
8. モーダル、画面内状態変更、遷移しない操作は区別する。遷移はMermaidの矢印で書く。
9. シーケンスの中央接続 `()` は活性区間とは別。活性区間はactivate/deactivateまたはメッセージの+/-を対応させる。
10. 以下の対応範囲と上限に従い、未対応構文を出力しない。

以下は対応構文リファレンスです。

配色が必要な場合は標準Mermaidの style / classDef / class で fill・stroke・color を指定する。ノード・グループに適用できる。色だけに意味を依存させず、ラベルも併用する。詳細な対応範囲は docs/SYNTAX.md を参照する。

担当別の業務フローには view:bpmn と標準flowchartを使える。BPMN 2.0完全対応とは説明せず、対象要素・レーン制約は docs/SYNTAX.md の「業務フロー」を参照する。

環境×サービスなどの行列や複数セルを占める枠が必要なら、SYNTAX.mdの `grid` 表示設定を利用する。文書直下は `grid`、各親の内部は `groups.<ID>.grid` に、`columns` と全直下要素の配置順を明示する。横結合は `colSpan`、縦結合は `rowSpan`。通常は `sizing:content`、全列・全行を均等化したい場合だけ `equal`。接続の意味と配置設定を混同しない。

経営・業務向けの概略・変更説明には `view:overview` を選ぶ。主要要素を業務の言葉で命名し、emphasisとcalloutで変更範囲・影響・効果を短く明示する。推測した効果や変更なしを断定しない。色だけで意味を伝えず、詳細図と概略図を分ける。構文はSYNTAX.mdに従う。
施策・導入の年表は標準timeline、操作から情報が変化する流れは標準eventmodelingを選ぶ。時系列の入力順・reset・明示参照を保ち、レイアウトの都合で並べ替えたり関連を増やしたりしない。


概略図の主経路を強調するときは `routing:"straight"` と標準Mermaidの `linkStyle ... stroke-width:4px` を検討する。線幅は0.5〜16px。直線は障害物を迂回しないため、SVGで交差を確認し、at配置または edges の個別 routing:"orthogonal" で調整する。仕様は docs/SYNTAX.md の「直線接続と線幅」を参照する。

概略図で変化点を伝える場合、コンポーネントの説明は nodes.<ID>.callout、接続に関する説明は edges.<0始まり番号>.callout に置く。calloutSize は数値pxまたは h1〜h6。重要な説明を h2、補足を h5 程度にし、全てを大文字にしない。矢印の色は標準 linkStyle の stroke で指定する。色だけで意味を伝えず、本文にも変更内容を書く。

概略図では最初に「何を判断してほしいか」を決め、その核だけを attention:focus、問題・影響を attention:problem にする。周辺のサーバー・ネットワーク・境界は context として状態と関係を残す。主役につながる全ての線を強調せず、主張を支える線だけに attention を指定する。emphasis（新規/変更）と視覚的重要度は混同しない。色だけに依存せず、問題や処置を明記する。attention の仕様は SYNTAX.md を参照。

主役の書体を変えるときは focus / problem の nodes.fontFamily に sans / serif / mono を指定する。見出し・吹き出しにだけ適用される。書体を乱用せず、周辺と本文は共通書体で読みやすさを維持する。詳細は SYNTAX.md を参照。


### 工程・日程を描くとき

標準 `gantt` を使い、dateFormat、section、タスクID、開始日/期間、after/untilで日程と依存を記述する。推測で実日程を確定しない。done/active/crit/milestoneで状態を示す。ArchMapはタスク名を左欄、日付を上軸に置き、依存線を表示する。色は標準config.themeVariablesで状態ごとに指定し、特定タスクの強調のみ既存nodes.ID.colorを使用する。長いタイトルを無理に短縮せず、数十工程を超える全体図は概要と詳細に分割する。対応範囲はSYNTAX.mdのガント節を参照する。
