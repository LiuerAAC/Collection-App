import { AppTab } from "../types";

const tabs: Array<{ id: AppTab; label: string; note: string; icon: string }> = [
  { id: "warehouse", label: "仓库", note: "Items", icon: "仓" },
  { id: "gallery", label: "Gallery", note: "Display", icon: "展" },
  { id: "analytics", label: "分析", note: "Stats", icon: "析" },
  { id: "settings", label: "设置", note: "System", icon: "设" }
];

export function BottomTabs({ activeTab, onChange }: { activeTab: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <nav className="tab-list" aria-label="Primary">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? "active" : ""}`.trim()}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-meta">
            <span>{tab.label}</span>
            <span className="muted">{tab.note}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
