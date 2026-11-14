"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  House,
  Settings2,
  RotateCw,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import {
  PencilDefinitions,
  TraceWordmark,
} from "@/components/trace/pencil-art";
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isThemeDetail = /^\/themes\/[^/]+\/?$/.test(path);
  const { loading, error, refresh } = useStudy();
  const links = [
    { href: "/", label: "ホーム", icon: House },
    { href: "/timer", label: "タイマー", icon: Timer },
  ];
  return (
    <div className="app-shell">
      <PencilDefinitions />
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <header
        className={cn("site-header", isThemeDetail && "theme-site-header")}
      >
        {isThemeDetail && (
          <Link href="/" className="header-back" aria-label="科目一覧に戻る">
            <ArrowLeft size={19} />
          </Link>
        )}
        <Link href="/" className="brand" aria-label="TRACE Note ホーム">
          <TraceWordmark />
        </Link>
        <Link href="/settings" className="header-settings" aria-label="設定">
          <Settings2 size={19} strokeWidth={1.5} />
        </Link>
      </header>
      <main id="main" className="main-content">
        {loading ? (
          <div className="loading-state" role="status">
            <BookOpen size={28} strokeWidth={1} />
            <p>ノートを開いています…</p>
          </div>
        ) : error ? (
          <div className="empty-state" role="alert">
            <h1>ノートを開けませんでした</h1>
            <p>{error}</p>
            <Button onClick={() => void refresh()}>
              <RotateCw /> 再試行
            </Button>
          </div>
        ) : (
          children
        )}
      </main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={
              path === href ||
              (href === "/" &&
                (path.startsWith("/themes") || path.startsWith("/subjects")))
                ? "page"
                : undefined
            }
            className={cn(
              "nav-link",
              (path === href ||
                (href === "/" &&
                  (path.startsWith("/themes") ||
                    path.startsWith("/subjects")))) &&
                "active",
            )}
          >
            <Icon size={19} strokeWidth={1.5} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
