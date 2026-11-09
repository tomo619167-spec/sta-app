# TRACE Note / sta-app

学びの軌跡を、ノートに残す。科目 → 学習テーマ → 学習項目で学びを整理する、スマホ向けの学習ノート。

## 起動

Node.js 24を推奨。APIキー・環境変数は不要です。

```sh
git clone https://github.com/tomo619167-spec/sta-app.git
cd sta-app
# この改善PRがマージされる前のみ
git checkout codex/phase-3-questions
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

ロードマップは4段階の習得度と項目数を示す縦型タイムラインです。輪郭・ハッチング・オリーブのマーカーを使い、旧％評価は履歴として残します。新しい評価への自動変換は行いません。

## 学習の導線

- ホーム：科目 → 学習テーマ。既存のテーマ管理と科目選択を維持
- テーマ詳細：科目・テーマ名・習得段階 → 学習項目4件（展開・すべて表示）→ テーマ全体を学ぶ → 過去問・演習
- 項目を展開して学習ボタンを押す2タップで開始。戻るとテーマ詳細の同じ項目を展開
- 学習目標は必要な時に開く。コンパクトな「説明できる以上」の件数からロードマップ詳細管理へ移動
- ロードマップ：テーマの到達目標、段階別の項目数、次に取り組む項目を表示。項目の追加・編集・削除・上下の並び替えに対応
- AIでロードマップを作成：プロンプト作成・コピー → 外部AIで生成 → JSON貼り付け・プレビュー・登録を1つの画面で進める。コピー後の自動遷移はなく、前のステップにも戻れる
- 生成済みのJSONは「JSONを直接取り込む」から開始。既存のversion 1の検証・重複確認・一括追加を再利用
- 入力とステップはテーマ別の下書きとして自動保存し、外部AIから戻った時や再読み込み時に復元。閉じても続きから開け、登録成功時に下書きを削除
- テーマ全体と学習項目の両方から、同じ学習画面へ移動。現在の対象を明示
- 科目アイコン：科目名から自動選択。「… → 科目を管理 → 科目の… → アイコンを変更」で手動変更・自動へ戻す
- 習得度：テーマ名付近のバッジで確認。「テーマの… → 習得度を変更」で更新。項目・学習画面からも選択でき、変更履歴を保存
- アウトプット：今回の説明を任意の4段階で評価。各回の日時・内容・評価を履歴表示し、記録画面で対象・種類を絞り込み可能
- アウトプット本文は30,000文字まで。到達目標は必要な時だけ開き、対象別に下書きを自動保存・復元
- 理解を深める：6種類のテンプレートから自分の問いを一つ書き、保存・編集・削除。対象名は自動で入り、保存した問いから外部AIに相談できる
- 記録を開く：本文の閲覧、完成度の確認、編集・確認付き削除。科目・テーマ・項目で絞り込み、項目のロードマップから記録へ移動
- AIフィードバック：コピー → 結果の貼り付け → JSONプレビュー → 保存。作業途中も復元し、自己評価・習得度・自分の問いと分離
- スマホ入力：既存の全画面フォーム・VisualViewport対応を再利用

過去問・ポモドーロタイマーは準備中です。アプリ内AI・独自の音声認識APIは搭載しません。テキスト欄は端末の標準キーボードの音声入力を利用できる構成ですが、実機での音声入力は未検証です。

通常のテーマ詳細の学習導線は維持し、作成ツールはロードマップ管理画面に集約しています。「次に取り組む」は表示順の未着手・学習中を優先し、該当がなければ未評価の項目を表示します。どの項目も一覧から自由に選べます。

## 保存構造・移行

同じ`yohaku-study`をIndexedDB **v6**へ自動移行します。ブラウザデータを消去せず、同じオリジン・同じブラウザで更新してください。

| ストア            | 内容                                                           |
| ----------------- | -------------------------------------------------------------- |
| subjects          | 科目のID・名称                                                 |
| themes            | 科目IDを持つテーマ。既存フィールドを維持                       |
| items             | テーマID、項目名、到達目標、順序、習得状態                     |
| records           | 対象種別・ID、日時、内容、活動種別、新4段階評価、旧％評価      |
| subject-icons     | 科目ID、アイコン、自動／手動、更新日時                         |
| mastery-history   | 連番ID、対象種別・ID、習得度、変更日時                         |
| roadmap-drafts    | テーマ別の入力・生成プロンプト・コピー済み状態・JSON・ステップ |
| learning-drafts   | 対象・活動別の本文、評価、問いの下書き                         |
| learning-feedback | 記録別のAIフィードバック、対象、元の本文と版                   |
| feedback-drafts   | 記録別のプロンプト・JSON・ステップの一時保存                   |
| legacy-themes-v1  | v1テーマ原本                                                   |
| legacy-records-v2 | 対象情報を追加する前の記録原本                                 |

v2からは、テーマ・科目・項目のIDと記録の本文・日時を維持し、項目に未設定の到達目標を追加します。記録原本を退避して、旧記録には`targetType: theme`、`targetId: 旧themeId`、`activity: memo`を付加します。旧記録に完成度を捏造しません。

v1からは既存の科目・項目への移行後、同じトランザクションでv6まで進みます。移行の失敗は全体をロールバックし、元のバージョンでデータが残ります。成功後の再読み込みで二重移行しません。

v3→v4では既存6ストアを更新せず、科目アイコンと習得度履歴のストアを追加します。既存科目のアイコンを初期設定し、旧％評価・旧習得済みを新評価へ変換しません。新評価はユーザーが選ぶまで「未評価」です。

Phase 2本体のスキーマ変更はありませんでした。テーマの既存の学習目標（`description`）と`items`を再利用し、別のロードマップデータは作りません。JSON取り込みはIDを新規発行し、既存項目・評価・記録を更新しません。新項目の習得度は未評価です。

v4→v5では`roadmap-drafts`ストアのみを追加し、既存8ストアの行は書き換えません。下書きはテーマIDをキーに保存し、項目の登録と同じトランザクションで削除します。登録失敗時は項目追加と下書き削除をまとめて取り消します。テーマ削除時はその下書きも削除します。

v5→v6では学習ドラフト・AIフィードバック・AI作業ドラフトの3ストアだけを追加し、既存9ストアの行は変更しません。正式保存と対応する下書き削除は同じトランザクションです。AIの内容を評価や気づきへ自動反映しません。既存の記録に新しい日時・評価・問いを自動付与しません。

### 習得度とアウトプット完成度

習得度は「未着手・学習中・説明できる・定着した」。アウトプット完成度は「まだ難しい・一部できた・概ねできた・十分できた」です。完成度は各回の任意評価で、未評価でも保存できます。直近の回が未評価なら、前の回の評価を引き継ぎません。

習得度と完成度、テーマと項目はそれぞれ独立し、自動連動や平均によるテーマ評価はありません。進捗は段階別の項目数とセグメントで示します。旧評価は「旧評価 60%」のように履歴で確認でき、習得度を下げても以前の評価は履歴に残ります。

削除済み・別テーマの項目を指定したURLは、テーマ全体へ勝手に切り替えずエラーを表示します。保存処理も同じ整合性を確認します。項目削除ではその項目の記録のみを、テーマ削除では項目・全記録・退避原本を同一トランザクションで削除します。削除は確認画面を経由します。

## 構成

Next.js 16.4.5 App Router / TypeScript / Tailwind CSS 4 / shadcn/ui構成のRadixプリミティブ / IndexedDB（idb）。依存はpackage-lock.jsonで固定しています。

- `lib/model.ts`：データ型、入力検証、名前の正規化、進捗
- `lib/storage/repository.ts`：保存処理のインターフェース
- `lib/storage/indexed-db.ts`：IndexedDB v6アダプターとv1〜v5移行
- `lib/learning.ts`：対象別の学習入力・下書き・記録の版
- `lib/learning-feedback.ts`：外部AIプロンプト、version 1・2のJSON検証、フィードバックの型
- `lib/json.ts`：ロードマップとフィードバックで共有するJSON検証
- `lib/ratings.ts`：独立した評価基準、履歴の最新値、段階別集計
- `lib/roadmap.ts`：表示順と次に取り組む項目
- `lib/roadmap-draft.ts`：テーマ別の一時ドラフトの型・検証
- `lib/roadmap-json.ts`：version 1の共通形式・検証・重複判定・固定プロンプト
- `lib/subject-icons.ts`：キーワード判定とアイコン設定型
- `lib/storage/index.ts`：アダプター選択。将来Supabase対応をここで切り替え
- `lib/learning-context.ts`：学習対象の解決と遷移URL。過去問は科目IDを主対象、テーマIDを任意の絞り込みとして扱う
- `components/study/learning-screen.tsx`：テーマ・項目共通の学習画面
- `components/study/learning-editor.tsx`：長文入力、4段階評価、問いのテンプレートと下書き保存
- `components/study/record-detail.tsx`：記録の閲覧・編集・削除とAIフィードバック
- `components/study/feedback-workflow.tsx`：外部AIとのコピー・JSON取り込みの共通フロー
- `components/study/daily-actions.tsx`：共通の2ボタン
- `components/study/roadmap-items.tsx`：項目の展開・習得状態・編集
- `components/study/roadmap-manager.tsx`：到達目標・進捗・作成ツールの管理画面
- `components/study/roadmap-workflow.tsx`：プロンプトから取り込みまでの共通ダイアログとステップ
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

Phase 3では型チェック・ビルド・単体テスト45件・E2E 90件が成功しました。学習記録・評価・下書き・AI結果の保存と復元、JSON検証、編集競合、失敗時のロールバック、並び替え、既存データ移行、Phase 1〜2の回帰を含みます。

実機の標準音声入力・IME・OSキーボード、外部AIサービスの実際の生成品質は自動テストに含みません。

今回の学習機能・AI連携・データ仕様は[docs/phase-3.md](docs/phase-3.md)を参照してください。

今回の統合フロー・下書き保存は[docs/roadmap-ai-flow.md](docs/roadmap-ai-flow.md)、ロードマップとJSON仕様は[docs/phase-2.md](docs/phase-2.md)、テーマ詳細の改善は[docs/theme-learning-entry.md](docs/theme-learning-entry.md)、評価・移行仕様は[docs/four-level-ratings.md](docs/four-level-ratings.md)、デザイン刷新の記録は[docs/trace-design-v1.md](docs/trace-design-v1.md)、学習導線の仕様は[docs/learning-navigation.md](docs/learning-navigation.md)を参照してください。過去の記録は[Phase 1.5](docs/phase-1-5.md)、[Phase 1](docs/phase-1.md)に残しています。

## 保存範囲

ページ更新後も保持されますが、別端末・別ブラウザへの同期、バックアップ・復元、オフライン起動は未対応です。ブラウザデータの消去やプライベートモード終了で消える場合があります。移行用原本も同じIndexedDB内にあるため、外部バックアップではありません。

## 次の開発

今後、過去問・演習、ポモドーロタイマー、クラウド同期を追加します。実機iOS Safari・Android Chromeでの標準音声入力とソフトキーボード確認、デプロイは別途必要です。

## 参考

- [Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui](https://ui.shadcn.com/docs/installation/manual)
- [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
- [Chromeのキーボードとビューポート](https://developer.chrome.com/blog/viewport-resize-behavior/)
