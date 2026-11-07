# 余白 — YOHAKU / sta-app

科目 → 学習テーマ → 学習項目で学びを整理する、スマホ向けの学習ノート。

## 起動

Node.js 24を推奨。APIキー・環境変数は不要です。

```sh
git clone https://github.com/tomo619167-spec/sta-app.git
cd sta-app
# Phase 1.5のPRがマージされる前のみ
git checkout codex/phase-1-5
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。ホームの「＋ テーマ」から、科目を選択・追加して学びを始められます。開発・本番ビルドはWebpackを明示しています。

```sh
npm run build
npm start
```

## Phase 1.5

- 科目ごとのテーマ一覧と絞り込み。最近の学びは最大2件
- 科目の選択・追加・名称変更。正規化した名称の一意インデックスで重複を防止
- テーマの作成・編集・移動・確認付き削除
- 学習項目の追加・編集・完了チェック・確認付き削除。項目から進捗を計算
- 学習メモの保存、詳細の最近3件と全記録画面
- 主要4機能はアイコン付きの短いボタン、ポモドーロは独立した「集中する」ボタン。編集・削除は「…」メニュー
- スマホの入力画面を全画面化。VisualViewportに追従し、本文だけをスクロール、保存ボタンを表示領域内に配置

ロードマップの整理・JSON取り込み、アウトプット、理解を深める、過去問、ポモドーロタイマー自体は**準備中**です。アプリ内AIは搭載しません。

## 保存構造・移行

IndexedDBの同じ`yohaku-study`データベースをバージョン1から2へ自動移行します。ブラウザデータの消去は不要です。同じオリジン・同じブラウザで更新してください。

| ストア           | 内容                                                 |
| ---------------- | ---------------------------------------------------- |
| subjects         | 科目。安定したID、表示名、正規化名                   |
| themes           | テーマ。科目IDと、既存の全フィールド                 |
| items            | 学習項目。テーマID、本文、順序、完了状態             |
| records          | 学習メモ。既存レコードは変更しない                   |
| legacy-themes-v1 | 移行前テーマの原本。旧科目文字列・ロードマップを含む |

旧テーマには`subjectId`だけを追加します。旧データの科目文字列・説明・日時・ID・ロードマップは変更せず、原本も退避します。同名科目は科目IDを共有し、旧ロードマップの内容・順序・完了状態を学習項目に引き継ぎます。移行全体を単一のversionchangeトランザクションで行い、失敗すればv1へロールバックします。再度開いても重複移行しません。

科目名を変更してもテーマはIDで関連付いたままです。テーマを別科目に移しても学習項目・記録は維持します。ユーザーが明示的にテーマを削除した場合のみ、そのテーマの項目・記録・退避原本を同時に削除します。科目自体は残ります。

旧版を別タブで開いていて移行が待機する場合は、画面に案内を表示します。該当タブを閉じると移行が続きます。

## 構成

Next.js 16.4.5 App Router / TypeScript / Tailwind CSS 4 / shadcn/ui構成のRadixプリミティブ / IndexedDB（idb）。依存はpackage-lock.jsonで固定しています。

- `lib/model.ts`：データ型、入力検証、名前の正規化、進捗
- `lib/storage/repository.ts`：保存処理のインターフェース
- `lib/storage/indexed-db.ts`：IndexedDB v2アダプターとv1移行
- `lib/storage/index.ts`：アダプター選択。将来Supabase対応をここで切り替え
- `components/study/`：画面・フォーム・科目選択・メニュー
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

詳しい結果と実機検証の限界は[docs/phase-1-5.md](docs/phase-1-5.md)を参照してください。Phase 1の履歴は[docs/phase-1.md](docs/phase-1.md)に残しています。

## 保存範囲

ページ更新後も保持されますが、別端末・別ブラウザへの同期、バックアップ・復元、オフライン起動は未対応です。ブラウザデータの消去やプライベートモード終了で消える場合があります。移行用原本も同じIndexedDB内にあるため、外部バックアップではありません。

## 次の開発

Phase 2でロードマップの整理・外部AI向けプロンプト・JSON検証と取り込みを追加します。実機iOS Safari・Android Chromeでのソフトキーボード確認、デプロイは別途必要です。

## 参考

- [Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui](https://ui.shadcn.com/docs/installation/manual)
- [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
- [Chromeのキーボードとビューポート](https://developer.chrome.com/blog/viewport-resize-behavior/)
