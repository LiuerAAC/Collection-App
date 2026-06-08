import React, { useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { BottomTabs } from "./src/components/BottomTabs";
import { AnalyticsScreen } from "./src/screens/AnalyticsScreen";
import { GalleryScreen } from "./src/screens/GalleryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { WarehouseScreen } from "./src/screens/WarehouseScreen";
import { CollectionProvider } from "./src/store/collectionStore";
import { colors, spacing } from "./src/theme";
import { AppTab } from "./src/types";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("warehouse");

  return (
    <CollectionProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Collection App v0.1</Text>
          <Text style={styles.title}>私人收藏管理</Text>
        </View>
        <View style={styles.body}>
          {activeTab === "warehouse" && <WarehouseScreen />}
          {activeTab === "gallery" && <GalleryScreen />}
          {activeTab === "analytics" && <AnalyticsScreen />}
          {activeTab === "settings" && <SettingsScreen />}
        </View>
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </SafeAreaView>
    </CollectionProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.bg,
    flex: 1
  },
  header: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  body: {
    flex: 1
  }
});

