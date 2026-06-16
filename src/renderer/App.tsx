import { useState } from "react";
import type { ReactElement } from "react";
import { DemoPage } from "./pages/DemoPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LessonPage } from "./pages/LessonPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TextbookPage } from "./pages/TextbookPage";
import { VideoPage } from "./pages/VideoPage";

type PageKey = "lesson" | "demo" | "video" | "textbook" | "history" | "settings";

type NavItem = {
  key: PageKey;
  label: string;
};

const navItems: NavItem[] = [
  { key: "lesson", label: "今日备课" },
  { key: "demo", label: "题目演示" },
  { key: "video", label: "视频生成" },
  { key: "textbook", label: "教材索引" },
  { key: "history", label: "历史记录" },
  { key: "settings", label: "设置" }
];

export function App(): ReactElement {
  const [activePage, setActivePage] = useState<PageKey>("lesson");

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-block">
          <strong>teacherHelper</strong>
          <span>教师工作台</span>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={activePage === item.key ? "active" : ""}
              aria-current={activePage === item.key ? "page" : undefined}
              onClick={() => setActivePage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content-area">
        {activePage === "lesson" ? <LessonPage /> : null}
        {activePage === "demo" ? <DemoPage /> : null}
        {activePage === "video" ? <VideoPage /> : null}
        {activePage === "textbook" ? <TextbookPage /> : null}
        {activePage === "history" ? <HistoryPage /> : null}
        {activePage === "settings" ? <SettingsPage /> : null}
      </main>
    </div>
  );
}
