import type { DiagramSample } from './types.js';
export const DIAGRAM_SAMPLES: DiagramSample[] = [
{id:'system',title:'システム構成図',subtitle:'Mermaidのsubgraphとアイコンで、入口からデータ層まで。',source:`---
title: 注文プラットフォーム
---
%% archmap: {"nodes":{"users":{"icon":"user","at":[1,2]},"cdn":{"icon":"aws/cloudfront","at":[2,2]},"web":{"icon":"browser","at":[3,2]},"api":{"icon":"gcp/cloud_run","at":[4,2]},"auth":{"icon":"shield","at":[4,1]},"db":{"icon":"database","at":[5,2],"color":"green"},"queue":{"icon":"queue","at":[4,3],"color":"orange"},"worker":{"icon":"server","at":[5,3]},"mail":{"icon":"globe","at":[6,3]}}}
flowchart LR
  users[利用者] --> cdn[CloudFront]
  subgraph cloud[Cloud / Tokyo]
    subgraph frontend[フロントエンド]
      cdn --> web[Web アプリ]
    end
    subgraph services[サービス]
      auth[認証] --> api[Orders API]
      web -->|注文| api
      api -->|読み書き| db[(注文データ)]
      api -.->|イベント| queue[注文キュー]
      queue --> worker[通知ワーカー]
    end
  end
  worker --> mail[メール配信]`},
{id:'layers',title:'レイヤースタック図',subtitle:'共通のMermaid入力を、責務ごとの層に配置。',source:`---
title: アプリケーションのレイヤー
---
%% archmap: {"view":"layers","nodes":{"web":{"icon":"browser"},"mobile":{"icon":"phone"},"orders":{"icon":"code"},"billing":{"icon":"code"},"db":{"icon":"database","color":"green"},"events":{"icon":"queue","color":"orange"}}}
flowchart TB
  subgraph presentation[Presentation]
    web[Web UI]
    mobile[Mobile UI]
  end
  subgraph domain[Domain]
    orders[Orders]
    billing[Billing]
  end
  subgraph infrastructure[Infrastructure]
    db[(Database)]
    events[Events]
  end
  web --> orders
  mobile --> billing
  orders --> db
  billing --> events`},
{id:'sequence',title:'シーケンス図',subtitle:'小さな参加者、活性区間、入れ子の分岐と並列処理。',source:`---
title: 注文の確定
---
sequenceDiagram
  actor user as お客様
  participant web as Web アプリ
  participant api as Orders API
  participant db as Database
  user->>web: 注文を確定
  web->>+api: POST /orders
  alt 在庫あり
    par 注文保存
      api->>+db: 注文を保存
      db-->>-api: 注文 ID
    and 通知予約
      api->>api: 通知イベントを作成
    end
    api-->>web: 201 Created
  else 在庫なし
    api-->>web: 409 Conflict
  end
  deactivate api
  web-->>user: 結果を表示`},
{id:'screens',title:'画面遷移図',subtitle:'遷移をアクション行に。モーダルや画面内操作も区別。',source:`---
title: ショッピングの画面遷移
---
%% archmap: {"view":"screens","nodes":{"home":{"icon":"browser","at":[1,1]},"detail":{"icon":"browser","at":[2,1]},"cart":{"icon":"browser","at":[3,1]},"confirm":{"shape":"modal","at":[3,2]},"done":{"at":[4,2]}},"actions":[{"node":"detail","label":"サイズを選ぶ","state":"選択済み"},{"node":"cart","label":"クーポンを適用","effect":"金額を再計算"},{"node":"confirm","label":"閉じる","close":true}]}
stateDiagram-v2
  state "ホーム" as home
  state "商品詳細" as detail
  state "カート" as cart
  state "購入の確認" as confirm
  state "注文完了" as done
  home --> detail: 商品を選ぶ
  detail --> cart: カートに追加
  cart --> detail: 買い物を続ける
  cart --> confirm: 購入に進む
  confirm --> done: 注文を確定`},
{id:'activity',title:'アクティビティ図',subtitle:'条件分岐とfork / joinで、業務の流れと並列処理を表現。',source:`---
title: 注文の処理
---
%% archmap: {"view":"activity"}
stateDiagram-v2
  direction TB
  state stock <<choice>>
  stock : 在庫あり？
  state parallel <<fork>>
  state complete <<join>>
  state "決済" as payment
  state "梱包" as packing
  state "出荷" as ship
  state "入荷を案内" as wait
  [*] --> stock
  stock --> parallel: はい
  stock --> wait: いいえ
  parallel --> payment
  parallel --> packing
  payment --> complete
  packing --> complete
  complete --> ship
  ship --> [*]
  wait --> [*]`},
{id:'er',title:'ER図',subtitle:'キー・属性・型と多重度を読みやすく。',source:`---
title: 注文と顧客のデータモデル
---
erDiagram
  direction LR
  CUSTOMER[顧客] {
    uuid id PK
    string name
    string email UK
  }
  ORDER[注文] {
    uuid id PK
    uuid customer_id FK
    datetime created_at
  }
  ORDER_ITEM[注文明細] {
    uuid order_id PK, FK
    uuid product_id PK, FK
    int quantity
  }
  PRODUCT[商品] {
    uuid id PK
    string name
    decimal price
  }
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||..o{ ORDER_ITEM : references`},
{id:'usecase',title:'ユースケース図',subtitle:'利用者・システム境界・目的と関係を整理。',source:`---
title: 注文サービスでできること
---
usecase-beta
  direction LR
  actor Customer(顧客)
  actor Admin(管理者)
  systemBoundary Shop[注文サービス]
    Browse(商品を探す)
    Place(注文する)
    Track(配送を確認する)
    Pay(支払う)
    Coupon(クーポンを適用する)
    Manage(商品を管理する)
  end
  Customer -- Browse
  Customer -- Place
  Customer -- Track
  Admin -- Manage
  Place ..> : include Pay
  Coupon ..> : extend Place
  note for Pay "決済が成功した場合に注文を確定する"`},
{id:'bpmn',title:'業務フロー（BPMN風）',subtitle:'担当レーンに処理・イベント・分岐を配置。',source:`%% archmap: {"view":"bpmn"}
---
title: 注文から発送まで
---
flowchart LR
  subgraph customer[顧客]
    start((開始)) --> order[注文する]
    receive[商品を受け取る] --> finish(((完了)))
  end
  subgraph shop[店舗]
    accept[注文を受け付ける] --> stock{在庫あり?}
    stock -->|はい| ship[発送する]
    stock -->|いいえ| notify[欠品を通知する]
  end
  order --> accept
  ship --> receive
  notify --> finish
  classDef event fill:#ecfdf5,stroke:#059669,color:#064e3b
  class start,finish event
`},
{id:'overview',title:'システム概要図',subtitle:'主役と問題にフォーカス。書体・吹き出し・線の色で伝える。',source:"---\ntitle: 不正利用を検知し、PCの通信を遮断する\n---\n%% archmap: {\"view\": \"overview\", \"nodes\": {\"servers\": {\"icon\": \"server\", \"description\": \"業務データ・個人情報\", \"callout\": \"個人情報等の不正利用\", \"calloutSize\": \"h6\"}, \"external\": {\"icon\": \"cloud\", \"description\": \"インターネット等の社外NW\", \"callout\": \"ファイル交換ソフト等の不正使用\", \"calloutSize\": \"h6\"}, \"lan\": {\"description\": \"業務サーバー・PC・監視装置を接続\"}, \"pc\": {\"icon\": \"user\", \"description\": \"【不正利用の例】\\nファイル交換ソフトの使用\\n個人情報等・業務メールの外部送付\\nWebからのダウンロード 等\", \"callout\": \"× 通信遮断\", \"calloutSize\": \"h1\", \"attention\": \"problem\"}, \"monitor\": {\"icon\": \"shield\", \"description\": \"① 操作ログ収集：PC操作ログを収集\\n② ログチェック：社内ルールでアプリの使用を監視\", \"callout\": \"③ 通信制御\\n不正利用PCの通信を\\n即座にネットワークから遮断\", \"calloutSize\": \"h4\", \"attention\": \"focus\", \"fontFamily\": \"serif\"}}, \"grid\": {\"columns\": 3, \"items\": [{\"id\": \"servers\"}, {\"id\": \"lan\"}, {\"id\": \"external\"}, {\"id\": \"pc\", \"colSpan\": 2}, {\"id\": \"patent\"}]}, \"edges\": {\"2\": {\"routing\": \"straight\", \"attention\": \"problem\"}, \"3\": {\"attention\": \"focus\"}, \"4\": {\"attention\": \"focus\"}}}\nflowchart TB\n  servers[業務サーバー群]\n  external[社外ネットワーク]\n  lan[社内LAN]\n  pc[利用者PC]\n  subgraph patent[特許出願中部分（原図の表記）]\n    monitor[監視・通信制御]\n  end\n  servers --- lan\n  external --- lan\n  lan --x pc\n  pc -->|① 操作ログ| monitor\n  monitor -->|③ 通信制御| lan\n  style lan fill:#fff9bd,stroke:#a59b24,color:#242417\n  style servers stroke:#64748b\n  style external stroke:#25848c\n  style pc stroke:#dc2626\n  style monitor stroke:#df6a19\n  style patent fill:#fffaf2,stroke:#df6a19,color:#a34a13\n  linkStyle default stroke:#48535e,stroke-width:2px\n  linkStyle 2 stroke:#dc2626,stroke-width:6px\n  linkStyle 3,4 stroke:#e67b18,stroke-width:3px\n"},
{id:'timeline',title:'タイムライン',subtitle:'施策・変更の順番を、期間と出来事で整理。',source:`---
title: 受注自動化の導入計画
---
timeline
  section 準備
    2026年11月 : 業務範囲を合意 : 影響システムを確認
    2026年12月 : 試行環境で検証
  section 展開
    2027年1月 : 一部拠点で先行運用
    2027年2月 : 全拠点へ展開 : 効果を確認
`},
{id:'eventmodeling',title:'イベントモデリング',subtitle:'操作・コマンド・イベントを時間の流れに沿って追う。',source:`---
title: 注文登録から在庫更新まで
---
eventmodeling
  tf 01 ui Order.Entry
  tf 02 cmd Order.PlaceOrder { orderId: string }
  tf 03 evt Order.OrderPlaced
  tf 04 pcr Inventory.Reserve
  tf 05 cmd Inventory.ReserveStock
  tf 06 evt Inventory.StockReserved
  tf 07 rmo Order.Status ->> 03 ->> 06
  tf 08 ui Order.Confirmation
`},
];
