# 余白 — YOHAKU / sta-app

高校生・大学生向けの、学びを深めるミニマルな学習Webアプリ。クリームホワイト、チャコール、オリーブグレーを使い、上質なノートを思わせるスマホファーストUIにしています。

## 起動

Node.js 24を推奨（Next.jsの最低要件は20.9以上）。APIキー、Supabase、環境変数の設定は不要です。

```sh
git clone https://github.com/tomo619167-spec/sta-app.git
cd sta-app
# PRがマージされる前は実装ブランチに切り替える
git checkout codex/phase-1-study-app
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。初回は白紙の状態です。「テーマを追加」から始めてください。

本番相当の起動：

```sh
npm run build
npm start
```

開発・ビルドともWebpackを明示しています。今回の実行環境ではTurbopack内部のローカルポート作成が制限されるためです。Next.js App Routerの構成は変わりません。

## Phase 1の実装

- ホーム：テーマ一覧、作成、進捗、最近学習したテーマ（最大3件）
- テーマ詳細：科目・説明、編集、確認付き削除、ロードマップ進捗、5機能の導線、最近の学習記録（最大5件）
- 学習を記録：短い学習メモを現在日時で保存。実際に記録したテーマだけを「最近の学び」に表示
- 記録画面：全記録とテーマ別の絞り込み
- 共通：下部ナビ、空状態、存在しないテーマ、読み込み中、保存不可時の表示、フォームの必須・文字数検証
- IndexedDB保存：ページ更新後も保持、テーマ削除時は関連記録も同一トランザクションで削除
- 320pxからPCまでのレスポンシブUI、44px以上の主要タップ領域、フォーカス表示、Radix Dialogによるフォーカス制御、safe-area対応

**5つの学習機能自体は未実装です。** 導線にも遷移先にも「準備中」と表示しています。Phase 1ではロードマップは未作成・0%で、実績を装うサンプルデータは投入しません。

AI機能、タイマー、過去問演習、JSON取り込みは動作しません。アプリ内AIは今後も搭載せず、外部AIとプロンプトのコピー・JSON取り込みで連携する設計方針です。

## 技術構成と分離

Next.js 16.4.5（App Router）/ TypeScript / Tailwind CSS 4 / shadcn/ui構成（new-york、Radixを使うButton・Dialog）/ IndexedDB（idb）。依存バージョンはpackage-lock.jsonで固定しています。Webフォントなど外部アセットの取得は不要です。

```text
app/                         App Routerのページ・共通レイアウト
components/study/            ホーム・詳細・フォーム・記録・共通UI
components/ui/               プロジェクトで所有・調整するUIプリミティブ
lib/model.ts                 データ型・入力検証・進捗の計算
lib/storage/repository.ts    UIから使う保存処理のインターフェース
lib/storage/indexed-db.ts    IndexedDBアダプター（DBバージョン1）
lib/storage/index.ts         利用するアダプターの選択
lib/features.ts             今後の5機能の表示・予定Phase
```

画面は`StudyRepository`インターフェースを使用し、IndexedDBを直接操作しません。将来のSupabase対応では認証・所有者チェック・移行を設計し、同インターフェースを実装したアダプターを追加します。現時点でSupabase接続や同期機能はありません。

テーマには作成・更新・最終学習日時とロードマップ項目、記録にはテーマID・本文・日時を保持します。進捗は完了項目数から計算します。テーマを開く、または編集するだけでは「学習した」扱いにしません。

## テスト

```sh
npm run typecheck
npm test
npm run build
# 初回だけブラウザを取得
npx playwright install chromium
npm run test:e2e
```

E2Eは本番ビルドを3100番ポートで起動します。すでに起動したローカルサーバーがあれば再利用します。テストごとに独立したブラウザコンテキストを使い、通常利用ブラウザのデータに触れません。

既存Chromeを使うmacOSの例：

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```

今回の検証結果は[docs/phase-1.md](docs/phase-1.md)に記載しています。

## ローカル保存の範囲

データは同一オリジン・同一ブラウザのIndexedDB内だけに保存されます。ページ更新で保持されますが、別端末・別ブラウザには同期されません。ブラウザデータ消去、プライベートブラウズ終了、端末故障などで失われる場合があります。バックアップ・復元、クラウド同期、サービスワーカーによるオフライン起動は今回の対象外です。

IndexedDBを利用できない場合、メモリ保存に切り替えて「保存済み」と装わず、エラーと再試行を表示します。保存に失敗したフォームは入力を維持します。

## 次の開発

1. Phase 2：ロードマップの項目管理・完了状態、外部AI用プロンプト、JSONのスキーマ検証・取り込み
2. Phase 3：アウトプット・理解を深めるノート
3. Phase 4：過去問・ポモドーロタイマー
4. Phase 5：記録の連携・振り返り。バックアップとSupabase認証・同期は導入前に移行方針を決める

実機のiOS Safari・Android Chromeでの操作確認と、ホスティング設定は次に必要です。今回の作業ではGitHubのPRを作成し、デプロイは実施していません。

## 参考

- [Next.js Installation](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui Manual Installation](https://ui.shadcn.com/docs/installation/manual)
- [shadcn/ui Next.js](https://ui.shadcn.com/docs/installation/next)
