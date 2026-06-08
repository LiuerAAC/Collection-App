import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { AppTab } from "../types";

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: "warehouse", label: "仓库" },
  { id: "gallery", label: "Gallery" },
  { id: "analytics", label: "分析" },
  { id: "settings", label: "设置" }
];

export function BottomTabs({ activeTab, onChange }: { activeTab: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => (
        <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={styles.tab}>
          <Text style={[styles.label, activeTab === tab.id && styles.activeLabel]}>{tab.label}</Text>
          <View style={[styles.indicator, activeTab === tab.id && styles.activeIndicator]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingBottom: spacing.md,
    paddingTop: spacing.sm
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  activeLabel: {
    color: colors.accent
  },
  indicator: {
    backgroundColor: "transparent",
    borderRadius: 3,
    height: 3,
    width: 24
  },
  activeIndicator: {
    backgroundColor: colors.accent
  }
});

