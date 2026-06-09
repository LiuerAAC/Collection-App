import { Card, Row, Screen, Section, Stat } from "../components/ui";
import { useCollection } from "../store/collectionStore";

export function AnalyticsScreen() {
  const { categories, items, purchases, saleRecords, tags } = useCollection();
  const itemAmount = purchases.reduce((sum, purchase) => sum + purchase.itemAmount, 0);
  const shippingAmount = purchases.reduce((sum, purchase) => sum + purchase.shippingAmount, 0);
  const totalAmount = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const saleAmount = saleRecords.reduce((sum, sale) => sum + sale.totalAmount, 0);

  return (
    <Screen title="数据开始有反馈，人才会愿意持续录" subtitle="PWA 第一版先给出最直接的数量和金额反馈，不在查询器里过度花活。">
      <Section title="核心看板">
        <div className="stats">
          <Stat label="藏品数" value={String(items.length)} />
          <Stat label="商品金额" value={`¥${itemAmount}`} />
          <Stat label="邮费" value={`¥${shippingAmount}`} />
          <Stat label="总金额" value={`¥${totalAmount}`} />
          <Stat label="售出总额" value={`¥${saleAmount}`} />
          <Stat label="标签数" value={String(tags.length)} />
        </div>
      </Section>

      <Section title="按大类统计">
        <div className="card-grid">
          {categories.map((category) => {
            const count = items.filter((item) => item.categoryId === category.id).length;
            return (
              <Card key={category.id}>
                <Row between>
                  <strong>{category.name}</strong>
                  <span>{count} 件</span>
                </Row>
              </Card>
            );
          })}
        </div>
      </Section>
    </Screen>
  );
}
