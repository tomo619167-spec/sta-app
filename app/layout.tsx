import type { Metadata, Viewport } from "next";
import { StudyProvider } from "@/components/study/provider";
import { Shell } from "@/components/study/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "TRACE Note — 学びの軌跡を、ノートに残す",
    template: "%s | TRACE Note",
  },
  description:
    "学びの軌跡を、ノートに残す。科目・テーマ・学習項目と日々の記録を育てる、あなただけの学習ノート。",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#F7F4EC",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <StudyProvider>
          <Shell>{children}</Shell>
        </StudyProvider>
      </body>
    </html>
  );
}
