import { useState } from "react";
import { BottomTabs } from "./components/BottomTabs";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { GalleryScreen } from "./screens/GalleryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WarehouseScreen } from "./screens/WarehouseScreen";
import { CollectionProvider } from "./store/collectionStore";
import { AppTab } from "./types";

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("warehouse");

  return (
    <CollectionProvider>
      <div className="app-shell">
        <header className="top-rail">
          <button className="app-badge" aria-label="Collection App" title="Collection App" type="button">
            <span className="brand-mark compact">CA</span>
          </button>
          <div className="top-rail-nav">
            <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </header>

        <main className="main-panel">
          {activeTab === "warehouse" && <WarehouseScreen />}
          {activeTab === "gallery" && <GalleryScreen />}
          {activeTab === "analytics" && <AnalyticsScreen />}
          {activeTab === "settings" && <SettingsScreen />}
        </main>
      </div>
    </CollectionProvider>
  );
}
