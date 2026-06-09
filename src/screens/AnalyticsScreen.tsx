import { useMemo, useState } from "react";
import { Card, Chip, Row, Screen, Section, Stat } from "../components/ui";
import { useCollection } from "../store/collectionStore";

function monthKey(value: string) {
  if (!value) return "";
  return value.slice(0, 7);
}

export function AnalyticsScreen() {
  const { categories, items, purchases, tags } = useCollection();
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");

  const inStockItems = items.filter((item) => item.status !== "sold" && item.status !== "traded");
  const inStockAmount = inStockItems.reduce((sum, item) => sum + Number(item.price ?? item.purchaseAmount ?? 0), 0);
  const allBuyOrders = purchases.filter((purchase) => purchase.kind === "buy");
  const allSellOrders = purchases.filter((purchase) => purchase.kind === "sell");

  const categoryOrders = purchases.filter((purchase) => purchase.categoryId === activeCategoryId);
  const buyOrders = categoryOrders.filter((purchase) => purchase.kind === "buy");
  const sellOrders = categoryOrders.filter((purchase) => purchase.kind === "sell");
  const categoryItems = items.filter((item) => item.categoryId === activeCategoryId);

  const monthlyFrequency = useMemo(() => {
    const counts = new Map<string, number>();
    categoryOrders.forEach((order) => {
      const key = monthKey(order.paidAt);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, count]) => ({ month, count }));
  }, [categoryOrders]);

  const maxFrequency = Math.max(...monthlyFrequency.map((entry) => entry.count), 1);
  const totalSpend = buyOrders.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const totalAmount = categoryOrders.reduce((sum, purchase) => sum + purchase.itemAmount, 0);
  const totalShipping = categoryOrders.reduce((sum, purchase) => sum + purchase.shippingAmount, 0);
  const totalFees = sellOrders.reduce((sum, purchase) => sum + purchase.feeAmount, 0);
  const totalIncome = sellOrders.reduce((sum, purchase) => sum + purchase.totalAmount, 0);

  return (
    <Screen title="Analytics" subtitle="Quick readouts for collection size and spend.">
      <Section title="Overview">
        <div className="stats">
          <Stat label="Items" value={String(inStockItems.length)} />
          <Stat label="Item amount" value={`¥${inStockAmount.toFixed(2)}`} />
          <Stat label="Orders" value={String(purchases.length)} />
          <Stat label="Buy orders" value={String(allBuyOrders.length)} />
          <Stat label="Sell orders" value={String(allSellOrders.length)} />
          <Stat label="Tags" value={String(tags.length)} />
        </div>
      </Section>

      <Section title="By category">
        <div className="container-rail single-line analytics-chip-rail">
          {categories.map((category) => (
            <Chip key={category.id} label={category.name} active={activeCategoryId === category.id} onClick={() => setActiveCategoryId(category.id)} />
          ))}
        </div>

        <div className="stats">
          <Stat label="Items" value={String(categoryItems.length)} />
          <Stat label="Total spend" value={`¥${totalSpend.toFixed(2)}`} />
          <Stat label="Amount" value={`¥${totalAmount.toFixed(2)}`} />
          <Stat label="Shipping" value={`¥${totalShipping.toFixed(2)}`} />
          <Stat label="Fees" value={`¥${totalFees.toFixed(2)}`} />
          <Stat label="Sell income" value={`¥${totalIncome.toFixed(2)}`} />
        </div>

        <Card>
          <div className="analytics-panel-head">
            <strong>Order heat</strong>
            <span className="muted">Activity since the first recorded order.</span>
          </div>
          {monthlyFrequency.length > 0 ? (
            <div className="heat-strip">
              {monthlyFrequency.map((entry) => (
                <div className="heat-cell" key={entry.month}>
                  <div
                    className="heat-bar"
                    style={{
                      opacity: 0.25 + entry.count / maxFrequency / 1.35,
                      height: `${32 + (entry.count / maxFrequency) * 42}px`
                    }}
                  />
                  <strong>{entry.count}</strong>
                  <span>{entry.month.replace("-", ".")}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="muted">No order activity in this category yet.</span>
          )}
        </Card>
      </Section>
    </Screen>
  );
}
