import { useEffect, useMemo, useState } from "react";
import { BottomTabs } from "./components/BottomTabs";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { GalleryScreen } from "./screens/GalleryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WarehouseScreen } from "./screens/WarehouseScreen";
import { CollectionProvider } from "./store/collectionStore";
import { AppTab } from "./types";

function useNetworkState() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("warehouse");
  const online = useNetworkState();
  const headerCopy = useMemo(
    () => ({
      eyebrow: online ? "PWA v0.1 · Online" : "PWA v0.1 · Offline",
      note: online ? "联网时可继续更新本地数据，后续接远端同步。" : "当前离线，仍可浏览本地已保存内容。"
    }),
    [online]
  );

  return (
    <CollectionProvider>
      <div className="app-shell">
        <header className="top-rail">
          <div className="brand-block">
            <div className="brand-mark">CA</div>
            <div className="brand-copy">
              <h1>Collection App</h1>
              <p className="eyebrow">{headerCopy.eyebrow}</p>
            </div>
          </div>
          <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
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
