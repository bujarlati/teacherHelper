import { useState } from "react";
import type { ReactElement } from "react";
import { SettingsPage } from "./pages/SettingsPage";

type PageKey = "lesson" | "demo" | "history" | "settings";

type NavItem = {
  key: PageKey;
  label: string;
};

const navItems: NavItem[] = [
  { key: "lesson", label: "今日备课" },
  { key: "demo", label: "题目演示" },
  { key: "history", label: "历史记录" },
  { key: "settings", label: "设置" }
];

const placeholderCopy: Record<Exclude<PageKey, "settings">, { title: string; text: string }> = {
  lesson: {
    title: "今日备课",
    text: "后续会在这里整理课题、学情、教学目标和导出入口。"
  },
  demo: {
    title: "题目演示",
    text: "后续会在这里生成题目动画演示和课堂讲解素材。"
  },
  history: {
    title: "历史记录",
    text: "后续会在这里查看已生成的教案、视频任务和课堂资料。"
  }
};

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
        {activePage === "settings" ? (
          <SettingsPage />
        ) : (
          <section className="workspace-panel placeholder-panel" aria-labelledby={`${activePage}-title`}>
            <p className="eyebrow">工作区</p>
            <h1 id={`${activePage}-title`}>{placeholderCopy[activePage].title}</h1>
            <p>{placeholderCopy[activePage].text}</p>
          </section>
        )}
      </main>
    </div>
  );
}
