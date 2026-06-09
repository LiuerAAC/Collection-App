import { AppTab } from "../types";

const tabs: Array<{ id: AppTab; label: string; icon: string }> = [
  { id: "warehouse", label: "Database", icon: "D" },
  { id: "gallery", label: "Gallery", icon: "G" },
  { id: "analytics", label: "Analytics", icon: "A" },
  { id: "settings", label: "Settings", icon: "S" }
];

export function BottomTabs({ activeTab, onChange }: { activeTab: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <nav className="tab-list" aria-label="Primary">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? "active" : ""}`.trim()}
          onClick={() => onChange(tab.id)}
          aria-label={tab.label}
          title={tab.label}
          type="button"
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
