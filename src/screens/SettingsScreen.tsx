import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Chip, Screen, Section } from "../components/ui";
import { colors, spacing } from "../theme";
import { useCollection } from "../store/collectionStore";

export function SettingsScreen() {
  const { categories, fields, tags, digitalAssets } = useCollection();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Section title="设置">
          <Card>
            <Text style={styles.title}>v0.1 项目状态</Text>
            <Text style={styles.meta}>移动端优先 · 私人收藏 · 默认卡牌模板 · 基础卡册 Gallery</Text>
          </Card>
        </Section>

        <Section title="分类与字段模板">
          {categories.map((category) => (
            <Card key={category.id}>
              <Text style={styles.title}>{category.name}</Text>
              <Text style={styles.meta}>{fields.filter((field) => field.categoryId === category.id).length} 个字段</Text>
              <View style={styles.rowWrap}>
                {fields.filter((field) => field.categoryId === category.id).slice(0, 8).map((field) => (
                  <Chip key={field.id} label={field.name} />
                ))}
              </View>
            </Card>
          ))}
        </Section>

        <Section title="全局 Tag">
          <View style={styles.rowWrap}>
            {tags.map((tag) => (
              <Chip key={tag.id} label={tag.name} />
            ))}
          </View>
        </Section>

        <Section title="数字化扫描">
          <Card>
            <Text style={styles.title}>素材状态</Text>
            <Text style={styles.meta}>已处理素材：{digitalAssets.filter((asset) => asset.status === "processed").length}</Text>
            <Text style={styles.meta}>v0.1 先记录正反面、裁切、透视校正和展示比例的数据结构。</Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: spacing.xs
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.sm
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap"
  }
});

