import { useMemo, useState } from "react";
import { Button, Card, Chip, EmptyState, Row, Screen, Section, Stack } from "../components/ui";
import { useCollection } from "../store/collectionStore";

const layoutMap = {
  "2x2": { rows: 2, columns: 2 },
  "3x3": { rows: 3, columns: 3 },
  "4x3": { rows: 4, columns: 3 }
};

export function GalleryScreen() {
  const { albums, albumSlots, items, placeItemInAlbum } = useCollection();
  const [activeAlbumId, setActiveAlbumId] = useState(albums[0]?.id);
  const [pageIndex, setPageIndex] = useState(0);
  const [pickIndex, setPickIndex] = useState(0);

  const album = albums.find((entry) => entry.id === activeAlbumId);
  const pickItem = items[pickIndex % Math.max(items.length, 1)];
  const layout = layoutMap[album?.layoutType ?? "3x3"];

  const slots = useMemo(() => {
    return Array.from({ length: layout.rows * layout.columns }, (_, index) => {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      const slot = albumSlots.find((entry) => entry.albumId === album?.id && entry.pageIndex === pageIndex && entry.row === row && entry.column === column);
      const item = items.find((entry) => entry.id === slot?.itemId);
      return { row, column, item };
    });
  }, [album?.id, albumSlots, items, layout.columns, layout.rows, pageIndex]);

  if (!album) {
    return (
      <Screen title="Gallery 还在等第一本卡册" subtitle="卡册是第一版最稳的展示容器。后续展板和自由摆放，会在 PWA 里继续扩。">
        <EmptyState title="暂无卡册" copy="先在数据层保留卡册结构，之后可以补完整创建流程。" />
      </Screen>
    );
  }

  return (
    <Screen title="先把展示变得有情绪" subtitle="PWA 第一版先支持卡册。固定卡位更稳，后面再做拖拽、旋转和展板。">
      <Section title="卡册选择" copy="同一藏品可以出现在多个展示场景里，数字展示不等于实体占位。">
        <Row wrap>
          {albums.map((entry) => (
            <Chip key={entry.id} label={entry.name} active={entry.id === album.id} onClick={() => setActiveAlbumId(entry.id)} />
          ))}
        </Row>
      </Section>

      <Card>
        <Stack>
          <Row between>
            <strong>{album.name}</strong>
            <span className="muted">{album.layoutType} · {album.pageCount} 页</span>
          </Row>
          <Row wrap>
            {Array.from({ length: album.pageCount }).map((_, index) => (
              <Chip key={index} label={`第 ${index + 1} 页`} active={pageIndex === index} onClick={() => setPageIndex(index)} />
            ))}
          </Row>
          <Row between>
            <span className="muted">当前待放入：{pickItem?.name || "无可用藏品"}</span>
            <Button label="切换待放入藏品" tone="quiet" onClick={() => setPickIndex((value) => value + 1)} />
          </Row>
          <div className="album-sheet">
            <div className="album-grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
              {slots.map((slot) => (
                <div className="slot" key={`${slot.row}-${slot.column}`}>
                  <strong>{slot.item?.name || "空位"}</strong>
                  <span className="muted">R{slot.row + 1} C{slot.column + 1}</span>
                  <Button
                    label={slot.item ? "替换" : "放入"}
                    tone="quiet"
                    onClick={() => pickItem && placeItemInAlbum(album.id, pageIndex, slot.row, slot.column, pickItem.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </Stack>
      </Card>
    </Screen>
  );
}
