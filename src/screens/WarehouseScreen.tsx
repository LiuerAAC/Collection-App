import React, { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Chip, Field, Screen, Section } from "../components/ui";
import { colors, spacing } from "../theme";
import { DraftItem, ItemStatus } from "../types";
import { useCollection } from "../store/collectionStore";

const statusLabels: Record<ItemStatus, string> = {
  owned: "已拥有",
  in_transit: "在途",
  sold: "已售出",
  traded: "已交换",
  wanted: "想要"
};

const emptyDraft: DraftItem = {
  name: "",
  categoryId: "cat-card",
  status: "owned",
  description: "",
  imageUrl: "",
  storageLocation: "",
  tagIds: [],
  customValues: {}
};

export function WarehouseScreen() {
  const { categories, fields, tags, items, purchases, saleRecords, addItem, addPurchase, addSaleRecord } = useCollection();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const categoryMatch = activeCategory === "all" || item.categoryId === activeCategory;
      const queryMatch = !query || item.name.toLowerCase().includes(query.toLowerCase());
      return categoryMatch && queryMatch;
    });
  }, [activeCategory, items, query]);

  const selectedFields = fields.filter((field) => field.categoryId === draft.categoryId).sort((a, b) => a.sortOrder - b.sortOrder);

  const saveItem = () => {
    if (!draft.name.trim()) {
      return;
    }

    const id = addItem(draft);
    setSelectedItemId(id);
    setDraft(emptyDraft);
  };

  const createDemoPurchase = () => {
    if (!selectedItem) return;
    addPurchase({
      merchant: "CardHobby Demo",
      platform: "CardHobby",
      paidAt: new Date().toISOString().slice(0, 10),
      title: `${selectedItem.name} 购买记录`,
      itemAmount: 100,
      shippingAmount: 12,
      currency: "CNY",
      sourceLink: "",
      notes: "v0.1 快速创建"
    }, [selectedItem.id]);
  };

  const createDemoSale = () => {
    if (!selectedItem) return;
    addSaleRecord({
      itemId: selectedItem.id,
      platform: "线下",
      soldAt: new Date().toISOString().slice(0, 10),
      buyer: "",
      saleAmount: 120,
      shippingAmount: 0,
      currency: "CNY",
      notes: "v0.1 快速创建"
    });
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Section title="仓库">
          <Field label="搜索" value={query} onChangeText={setQuery} placeholder="搜索藏品名称" />
          <View style={styles.rowWrap}>
            <Chip label="全部" active={activeCategory === "all"} onPress={() => setActiveCategory("all")} />
            {categories.map((category) => (
              <Chip key={category.id} label={category.name} active={activeCategory === category.id} onPress={() => setActiveCategory(category.id)} />
            ))}
          </View>
          {visibleItems.map((item) => {
            const category = categories.find((entry) => entry.id === item.categoryId);
            const purchase = purchases.find((entry) => entry.id === item.purchaseId);
            const sale = saleRecords.find((entry) => entry.id === item.saleRecordId);
            return (
              <Card key={item.id}>
                <View style={styles.itemRow}>
                  <View style={styles.thumb}>
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <Text style={styles.thumbText}>图</Text>}
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.meta}>{category?.name} · {statusLabels[item.status]}</Text>
                    <Text style={styles.meta}>位置：{item.storageLocation || "未记录"}</Text>
                    <Text style={styles.meta}>购买：{purchase ? `${purchase.totalAmount} ${purchase.currency}` : "未关联"}</Text>
                    <Text style={styles.meta}>售出：{sale ? `${sale.totalAmount} ${sale.currency}` : "未关联"}</Text>
                    <View style={styles.rowWrap}>
                      {item.tagIds.map((tagId) => {
                        const tag = tags.find((entry) => entry.id === tagId);
                        return tag ? <Chip key={tag.id} label={tag.name} /> : null;
                      })}
                    </View>
                    <Button label="选中" onPress={() => setSelectedItemId(item.id)} tone="quiet" />
                  </View>
                </View>
              </Card>
            );
          })}
        </Section>

        <Section title="新增藏品">
          <Card>
            <Field label="名称" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="例如：梅西 Topps Chrome" />
            <Text style={styles.label}>大类</Text>
            <View style={styles.rowWrap}>
              {categories.map((category) => (
                <Chip key={category.id} label={category.name} active={draft.categoryId === category.id} onPress={() => setDraft({ ...draft, categoryId: category.id, customValues: {} })} />
              ))}
            </View>
            <Field label="图片 URL" value={draft.imageUrl} onChangeText={(imageUrl) => setDraft({ ...draft, imageUrl })} placeholder="v0.1 先用图片链接占位" />
            <Field label="实体存放位置" value={draft.storageLocation} onChangeText={(storageLocation) => setDraft({ ...draft, storageLocation })} placeholder="例如：白色卡盒 A / 第 1 排" />
            <Text style={styles.label}>标签</Text>
            <View style={styles.rowWrap}>
              {tags.map((tag) => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  active={draft.tagIds.includes(tag.id)}
                  onPress={() => setDraft({
                    ...draft,
                    tagIds: draft.tagIds.includes(tag.id) ? draft.tagIds.filter((id) => id !== tag.id) : [...draft.tagIds, tag.id]
                  })}
                />
              ))}
            </View>
            {selectedFields.slice(0, 6).map((field) => (
              <Field
                key={field.id}
                label={field.name}
                value={String(draft.customValues[field.id] ?? "")}
                onChangeText={(value) => setDraft({ ...draft, customValues: { ...draft.customValues, [field.id]: value } })}
                placeholder={field.options?.join(" / ") || field.name}
              />
            ))}
            <Button label="保存藏品" onPress={saveItem} />
          </Card>
        </Section>

        <Section title="选中藏品快捷记录">
          <Card>
            <Text style={styles.itemTitle}>{selectedItem?.name || "暂无藏品"}</Text>
            <Text style={styles.meta}>v0.1 先提供快捷创建，后续拆成完整表单。</Text>
            <View style={styles.actionRow}>
              <Button label="添加购买记录" onPress={createDemoPurchase} tone="quiet" />
              <Button label="添加售出记录" onPress={createDemoSale} tone="danger" />
            </View>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  thumb: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    height: 96,
    justifyContent: "center",
    overflow: "hidden",
    width: 72
  },
  image: {
    height: "100%",
    width: "100%"
  },
  thumbText: {
    color: colors.muted,
    fontWeight: "700"
  },
  itemBody: {
    flex: 1,
    gap: spacing.xs
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  meta: {
    color: colors.muted,
    fontSize: 13
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.md
  }
});

