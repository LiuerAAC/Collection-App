import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Chip, Screen, Section } from "../components/ui";
import { colors, spacing } from "../theme";
import { useCollection } from "../store/collectionStore";

const layoutMap = {
  "2x2": { rows: 2, columns: 2 },
  "3x3": { rows: 3, columns: 3 },
  "4x3": { rows: 4, columns: 3 }
};

export function GalleryScreen() {
  const { albums, albumSlots, items, placeItemInAlbum } = useCollection();
  const [albumId, setAlbumId] = useState(albums[0]?.id);
  const [pageIndex, setPageIndex] = useState(0);
  const [pickIndex, setPickIndex] = useState(0);
  const album = albums.find((entry) => entry.id === albumId) ?? albums[0];
  const layout = layoutMap[album?.layoutType ?? "3x3"];
  const pickItem = items[pickIndex % Math.max(items.length, 1)];

  const grid = useMemo(() => {
    return Array.from({ length: layout.rows }).map((_, row) => (
      Array.from({ length: layout.columns }).map((__, column) => {
        const slot = albumSlots.find((entry) => entry.albumId === album?.id && entry.pageIndex === pageIndex && entry.row === row && entry.column === column);
        return { row, column, slot, item: items.find((entry) => entry.id === slot?.itemId) };
      })
    ));
  }, [album?.id, albumSlots, items, layout.columns, layout.rows, pageIndex]);

  if (!album) {
    return (
      <Screen>
        <Section title="Gallery">
          <Card>
            <Text style={styles.title}>暂无卡册</Text>
          </Card>
        </Section>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Section title="Gallery">
          <View style={styles.rowWrap}>
            {albums.map((entry) => (
              <Chip key={entry.id} label={entry.name} active={entry.id === album.id} onPress={() => setAlbumId(entry.id)} />
            ))}
          </View>
          <Card>
            <View style={[styles.albumCover, { backgroundColor: album.coverColor }]}>
              <Text style={styles.albumTitle}>{album.name}</Text>
              <Text style={styles.albumMeta}>{album.layoutType} · {album.pageCount} 页 · {album.doubleSided ? "支持正反" : "单面"}</Text>
            </View>
            <View style={styles.pageControls}>
              {Array.from({ length: album.pageCount }).map((_, index) => (
                <Chip key={index} label={`第 ${index + 1} 页`} active={index === pageIndex} onPress={() => setPageIndex(index)} />
              ))}
            </View>
            <Text style={styles.helper}>当前待放入：{pickItem?.name || "暂无藏品"}。点击卡位即可放入，同一藏品可进入多个展示场景。</Text>
            <View style={styles.pickerRow}>
              <Button label="切换待放入藏品" onPress={() => setPickIndex((value) => value + 1)} tone="quiet" />
            </View>
            <View style={styles.sheet}>
              {grid.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.gridRow}>
                  {row.map((cell) => (
                    <View key={`${cell.row}-${cell.column}`} style={styles.slot}>
                      <Text style={styles.slotTitle}>{cell.item?.name || "空位"}</Text>
                      <Text style={styles.slotMeta}>R{cell.row + 1} C{cell.column + 1}</Text>
                      <Button
                        label={cell.item ? "替换" : "放入"}
                        tone="quiet"
                        onPress={() => pickItem && placeItemInAlbum(album.id, pageIndex, cell.row, cell.column, pickItem.id)}
                      />
                    </View>
                  ))}
                </View>
              ))}
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
  albumCover: {
    borderRadius: 8,
    padding: spacing.lg
  },
  albumTitle: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: "900"
  },
  albumMeta: {
    color: colors.surface,
    fontSize: 13,
    marginTop: spacing.xs,
    opacity: 0.86
  },
  pageControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md
  },
  helper: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md
  },
  pickerRow: {
    marginBottom: spacing.md
  },
  sheet: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    gap: spacing.sm,
    padding: spacing.sm
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  slot: {
    alignItems: "center",
    aspectRatio: 0.72,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.sm
  },
  slotTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  slotMeta: {
    color: colors.muted,
    fontSize: 10
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  }
});

