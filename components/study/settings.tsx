import { TraceWordmark } from "@/components/trace/pencil-art";
import { HardDrive } from "lucide-react";
export function SettingsScreen() {
  return (
    <>
      <header className="page-heading">
        <h1>設定</h1>
      </header>
      <section className="settings-block">
        <HardDrive size={22} strokeWidth={1.3} />
        <h2>この端末に保存</h2>
        <p>
          データはこのブラウザに保存されます。端末間の同期・バックアップは未対応です。
        </p>
        <p>
          ブラウザのデータ消去やプライベートモードの終了で、記録が失われる場合があります。
        </p>
      </section>
      <section className="settings-block">
        <h2>これからの機能</h2>
        <p>
          学習機能は順次追加予定です。外部AIとはプロンプトのコピー・JSON取り込みで連携します。
        </p>
      </section>
      <div className="about-brand">
        <TraceWordmark />
        <small>Design Ver.1</small>
      </div>
    </>
  );
}
