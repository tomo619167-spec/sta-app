import type { Metadata, Viewport } from "next";
import { StudyProvider } from "@/components/study/provider";
import { Shell } from "@/components/study/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "余白 — 学びを深めるノート", template: "%s | 余白" },
  description:
    "「わかる」を、自分の言葉に。学習テーマと日々の学びを育てる、あなただけのミニマルな学習ノート。",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f8f7f2",
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
