# TRACE Note / sta-app

学びの軌跡を、ノートに残す。科目 → 学習テーマ → 学習項目で学びを整理する、スマホ向けの学習ノート。

## 起動

Node.js 24を推奨。APIキー・環境変数は不要です。

```sh
git clone https://github.com/tomo619167-spec/sta-app.git
cd sta-app
# この改善PRがマージされる前のみ
git checkout codex/trace-note-design-v1
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。ホームの「＋ テーマ」から、科目を選択・追加して学びを始められます。開発・本番ビルドはWebpackを明示しています。

```sh
npm run build
npm start
```

## デザイン Ver.1

クリームホワイトの紙、明朝体の見出し、細い鉛筆の線を基調としています。ホームの「学習の軌跡」と科目の進捗は実データを集計します。科目はホームの「＋ 科目を追加」から作成できます。

配色・フォント・余白・操作サイズは `app/tokens.css`、既存画面の構造は `app/components.css`、TRACE Noteの外観は `app/trace.css` に分離しています。画像アセットの大量追加や外部フォントの読み込みはありません。

ロードマップは未学習（輪郭）・学習中（ハッチング）・習得済み（オリーブ）の縦型タイムラインです。未習得の項目に項目単位の記録がある場合を「学習中」と表示し、チェック操作で習得済みにします。既存の保存値・完成度・データベース名は変更しません。

## 学習の導線

- ホーム：科目 → 学習テーマ。既存のテーマ管理と科目選択を維持
- テーマ詳細：科目・テーマ名 → タップできるロードマップ進捗 → 横並びの日常学習 → 独立した過去問セクション
- ロードマップ：項目をタップして展開。到達目標・習得状態・アウトプット・理解を深めるを表示
- テーマ全体と学習項目の両方から、同じ学習画面へ移動。現在の対象を明示
- 学習メモ：対象種別・ID、学習日時、内容、任意の完成度を保存。記録画面は対象種別でも絞り込み可能
- スマホ入力：既存の全画面フォーム・VisualViewport対応を再利用

アウトプットの専用編集、理解を深める専用ワークフロー、外部AI向けプロンプト・JSON取り込みは準備中です。対象を確認して既存の学習メモを残せる段階です。過去問・ポモドーロタイマー自体も準備中で、アプリ内AIは搭載しません。

## 保存構造・移行

同じ`yohaku-study`をIndexedDB **v3**へ自動移行します。ブラウザデータを消去せず、同じオリジン・同じブラウザで更新してください。

| ストア            | 内容                                                       |
| ----------------- | ---------------------------------------------------------- |
| subjects          | 科目のID・名称                                             |
| themes            | 科目IDを持つテーマ。既存フィールドを維持                   |
| items             | テーマID、項目名、到達目標、順序、習得状態                 |
| records           | テーマID、対象種別・ID、日時、内容、活動種別、任意の完成度 |
| legacy-themes-v1  | v1テーマ原本                                               |
| legacy-records-v2 | 対象情報を追加する前の記録原本                             |

v2からは、テーマ・科目・項目のIDと記録の本文・日時を維持し、項目に未設定の到達目標を追加します。記録原本を退避して、旧記録には`targetType: theme`、`targetId: 旧themeId`、`activity: memo`を付加します。旧記録に完成度を捏造しません。

v1からは既存の科目・項目への移行後、同じトランザクションでv3まで進みます。移行の失敗は全体をロールバックし、元のバージョンでデータが残ります。成功後の再読み込みで二重移行しません。

### 進捗と完成度

ロードマップの進捗は、習得済み項目数から計算します。記録の「完成度」はその対象への自己評価で、対象種別とIDの組み合わせごとに独立します。完成度を設定した最新記録を表示し、未設定のメモではその評価を変更しません。0%と未設定は区別します。

項目の完成度をテーマに平均・集約する処理はありません。項目の完成度を90%にしてもテーマ全体の完成度やロードマップの習得状態は変わりません。

削除済み・別テーマの項目を指定したURLは、テーマ全体へ勝手に切り替えずエラーを表示します。保存処理も同じ整合性を確認します。項目削除ではその項目の記録のみを、テーマ削除では項目・全記録・退避原本を同一トランザクションで削除します。削除は確認画面を経由します。

## 構成

Next.js 16.4.5 App Router / TypeScript / Tailwind CSS 4 / shadcn/ui構成のRadixプリミティブ / IndexedDB（idb）。依存はpackage-lock.jsonで固定しています。

- `lib/model.ts`：データ型、入力検証、名前の正規化、進捗
- `lib/storage/repository.ts`：保存処理のインターフェース
- `lib/storage/indexed-db.ts`：IndexedDB v3アダプターとv1/v2移行
- `lib/storage/index.ts`：アダプター選択。将来Supabase対応をここで切り替え
- `lib/learning-context.ts`：学習対象の解決と遷移URL。過去問は科目IDを主対象、テーマIDを任意の絞り込みとして扱う
- `components/study/learning-screen.tsx`：テーマ・項目共通の学習画面
- `components/study/daily-actions.tsx`：共通の2ボタン
- `components/study/roadmap-items.tsx`：項目の展開・習得状態・編集
- `components/study/`：既存の画面・フォーム・科目選択・メニュー
- `components/ui/dialog.tsx`：VisualViewport対応のダイアログ
- `components/study/editor-dialog.tsx`：共通の全画面入力レイアウト

## 検証

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

E2EはChromiumのPixel 7プロファイル、WebKitのiPhone 13プロファイル、PCのChromiumを使用します。本番ビルドを3100番ポートで起動し、テストごとにブラウザコンテキストを分離します。

既存Chromeを使用する場合は`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`に実行ファイルを指定できます。WebKitは別途取得してください。

スマホのプロジェクトはタップ操作、PCはマウスクリックを使います。表示領域の縮小・移動を再現しますが、実機のOSキーボードを使うテストではありません。

今回のデザイン仕様・検証は[docs/trace-design-v1.md](docs/trace-design-v1.md)、学習導線の仕様は[docs/learning-navigation.md](docs/learning-navigation.md)を参照してください。過去の記録は[Phase 1.5](docs/phase-1-5.md)、[Phase 1](docs/phase-1.md)に残しています。

## 保存範囲

ページ更新後も保持されますが、別端末・別ブラウザへの同期、バックアップ・復元、オフライン起動は未対応です。ブラウザデータの消去やプライベートモード終了で消える場合があります。移行用原本も同じIndexedDB内にあるため、外部バックアップではありません。

## 次の開発

今後、アウトプット・理解を深める専用機能、ロードマップの並べ替え、外部AI向けプロンプト・JSON取り込みを追加します。実機iOS Safari・Android Chromeでのソフトキーボード確認、デプロイは別途必要です。

## 参考

- [Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui](https://ui.shadcn.com/docs/installation/manual)
- [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
- [Chromeのキーボードとビューポート](https://developer.chrome.com/blog/viewport-resize-behavior/)
