import { HardDrive, Sprout } from "lucide-react";
export function SettingsScreen() {
  return (
    <>
      <section className="page-intro">
        <span className="eyebrow">ABOUT YOUR NOTEBOOK</span>
        <h1>ノートについて。</h1>
        <p>あなたのペースで、あなたの学びを。</p>
      </section>
      <section className="settings-block">
        <HardDrive size={22} strokeWidth={1.3} />
        <h2>この端末に、大切に保存。</h2>
        <p>
          テーマと学習記録は、このブラウザの中に保存されます。ページを再読み込みしても残りますが、別の端末やブラウザには同期されません。
        </p>
        <p>
          ブラウザのデータ消去やプライベートブラウズの終了で、記録が失われることがあります。現在、バックアップ・復元機能は未対応です。
        </p>
      </section>
      <section className="settings-block">
        <Sprout size={22} strokeWidth={1.3} />
        <h2>これから育つ、5つの学び。</h2>
        <p>
          ロードマップ、アウトプット、ポモドーロタイマー、過去問モード、理解を深める。学びを支える機能を、ひとつずつ追加していきます。
        </p>
        <p>
          AIはアプリ内には搭載しません。外部AI用のプロンプトコピーとJSON取り込みを、今後の機能として予定しています。
        </p>
      </section>
      <div className="about-brand">
        <span>余白</span>
        <p>YOHAKU — A SPACE TO UNDERSTAND</p>
        <small>Phase 1 · version 0.1.0</small>
      </div>
    </>
  );
}
