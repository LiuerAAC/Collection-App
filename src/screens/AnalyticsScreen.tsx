import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Screen, Section, Stat } from "../components/ui";
import { colors, spacing } from "../theme";
import { useCollection } from "../store/collectionStore";

export function AnalyticsScreen() {
  const { categories, items, purchases, saleRecords, tags } = useCollection();
  const itemAmount = purchases.reduce((sum, purchase) => sum + purchase.itemAmount, 0);
  const shippingAmount = purchases.reduce((sum, purchase) => sum + purchase.shippingAmount, 0);
  const totalAmount = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const saleAmount = saleRecords.reduce((sum, sale) => sum + sale.totalAmount, 0);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Section title="分析">
          <View style={styles.statsRow}>
            <Stat label="藏品数" value={String(items.length)} />
            <Stat label="商品金额" value={`¥${itemAmount}`} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="邮费" value={`¥${shippingAmount}`} />
            <Stat label="总金额" value={`¥${totalAmount}`} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="售出总额" value={`¥${saleAmount}`} />
            <Stat label="卡册数" value="1" />
          </View>
        </Section>

        <Section title="按大类统计">
          {categories.map((category) => {
            const count = items.filter((item) => item.categoryId === category.id).length;
            return (
              <Card key={category.id}>
                <View style={styles.line}>
                  <Text style={styles.title}>{category.name}</Text>
                  <Text style={styles.value}>{count} 件</Text>
                </View>
              </Card>
            );
          })}
        </Section>

        <Section title="按 Tag 统计">
          {tags.map((tag) => {
            const count = items.filter((item) => item.tagIds.includes(tag.id)).length;
            return (
              <Card key={tag.id}>
                <View style={styles.line}>
                  <Text style={styles.title}>{tag.name}</Text>
                  <Text style={styles.value}>{count} 件</Text>
                </View>
              </Card>
            );
          })}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md
  },
  line: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "800"
  }
});

