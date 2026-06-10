import { useEffect, useMemo, useState } from "react";
import { Card, Chip, Screen, Section, Stat } from "../components/ui";
import { useCollection } from "../store/collectionStore";
import { CollectionItem, Tag } from "../types";

type CustomMetricKey =
  | "item_count"
  | "photo_count"
  | "in_stock_value"
  | "buy_spend"
  | "sales_income"
  | "net_cashflow"
  | "avg_item_value"
  | "sold_rate";

const metricOptions: Array<{ key: CustomMetricKey; label: string }> = [
  { key: "item_count", label: "Items" },
  { key: "photo_count", label: "Photos" },
  { key: "in_stock_value", label: "In-stock value" },
  { key: "buy_spend", label: "Buy spend" },
  { key: "sales_income", label: "Sales" },
  { key: "net_cashflow", label: "Net cashflow" },
  { key: "avg_item_value", label: "Avg item value" },
  { key: "sold_rate", label: "Sold rate" }
];

const defaultCustomMetrics: CustomMetricKey[] = ["item_count", "photo_count", "in_stock_value", "buy_spend"];

function monthKey(value: string) {
  if (!value) return "";
  return value.slice(0, 7);
}

function priceBand(item: CollectionItem) {
  const amount = Number(item.price ?? item.purchaseAmount ?? 0);
  if (amount <= 0) return "Not priced";
  if (amount < 100) return "< ¥100";
  if (amount < 500) return "¥100 - ¥499";
  if (amount < 1000) return "¥500 - ¥999";
  return "¥1000+";
}

function includesAllTags(item: CollectionItem, selectedTagIds: string[]) {
  if (selectedTagIds.length === 0) return true;
  return selectedTagIds.every((tagId) => item.tagIds.includes(tagId));
}

export function AnalyticsScreen() {
  const { categories, items, photoShots, purchases, saleRecords, tags } = useCollection();
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [customCategoryId, setCustomCategoryId] = useState<"all" | string>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<CustomMetricKey[]>(defaultCustomMetrics);

  useEffect(() => {
    if (!categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0]?.id ?? "");
    }
    if (customCategoryId !== "all" && !categories.some((category) => category.id === customCategoryId)) {
      setCustomCategoryId("all");
    }
  }, [activeCategoryId, categories, customCategoryId]);

  const inStockItems = items.filter((item) => item.status !== "sold" && item.status !== "traded");
  const inStockAmount = inStockItems.reduce((sum, item) => sum + Number(item.price ?? item.purchaseAmount ?? 0), 0);
  const allBuyOrders = purchases.filter((purchase) => purchase.kind === "buy");
  const itemCategoryMap = useMemo(() => new Map(items.map((item) => [item.id, item.categoryId])), [items]);
  const allSaleRecords = saleRecords;

  const categoryOrders = purchases.filter((purchase) => purchase.categoryId === activeCategoryId);
  const buyOrders = categoryOrders.filter((purchase) => purchase.kind === "buy");
  const categoryItems = items.filter((item) => item.categoryId === activeCategoryId);
  const categorySaleRecords = saleRecords.filter((record) => itemCategoryMap.get(record.itemId) === activeCategoryId);

  const monthlyActivity = useMemo(() => {
    const counts = new Map<string, number>();
    categoryOrders.forEach((order) => {
      const key = monthKey(order.paidAt);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    categorySaleRecords.forEach((record) => {
      const key = monthKey(record.soldAt);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, count]) => ({ month, count }));
  }, [categoryOrders, categorySaleRecords]);

  const maxFrequency = Math.max(...monthlyActivity.map((entry) => entry.count), 1);
  const totalSpend = buyOrders.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const totalPurchaseAmount = buyOrders.reduce((sum, purchase) => sum + purchase.itemAmount, 0);
  const totalPurchaseShipping = buyOrders.reduce((sum, purchase) => sum + purchase.shippingAmount, 0);
  const totalSales = categorySaleRecords.reduce((sum, record) => sum + record.saleAmount, 0);
  const netSaleIncome = categorySaleRecords.reduce((sum, record) => sum + record.totalAmount, 0);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const categoryMatch = customCategoryId === "all" || item.categoryId === customCategoryId;
        return categoryMatch && includesAllTags(item, selectedTagIds);
      }),
    [customCategoryId, items, selectedTagIds]
  );

  const filteredItemIds = useMemo(() => new Set(filteredItems.map((item) => item.id)), [filteredItems]);
  const filteredPurchaseIds = useMemo(
    () => new Set(filteredItems.map((item) => item.purchaseId).filter((purchaseId): purchaseId is string => Boolean(purchaseId))),
    [filteredItems]
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((purchase) => {
        const categoryMatch = customCategoryId === "all" || purchase.categoryId === customCategoryId;
        return categoryMatch && filteredPurchaseIds.has(purchase.id);
      }),
    [customCategoryId, filteredPurchaseIds, purchases]
  );

  const filteredSaleRecords = useMemo(
    () => saleRecords.filter((record) => filteredItemIds.has(record.itemId)),
    [filteredItemIds, saleRecords]
  );

  const filteredPhotos = useMemo(
    () => photoShots.filter((photo) => photo.itemIds.some((itemId) => filteredItemIds.has(itemId))),
    [filteredItemIds, photoShots]
  );

  const filteredInStockItems = filteredItems.filter((item) => item.status !== "sold" && item.status !== "traded");
  const filteredInStockValue = filteredInStockItems.reduce((sum, item) => sum + Number(item.price ?? item.purchaseAmount ?? 0), 0);
  const filteredBuySpend = filteredPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const filteredSalesIncome = filteredSaleRecords.reduce((sum, record) => sum + record.totalAmount, 0);
  const filteredNetCashflow = filteredSalesIncome - filteredBuySpend;
  const filteredAverageItemValue = filteredItems.length > 0
    ? filteredItems.reduce((sum, item) => sum + Number(item.price ?? item.purchaseAmount ?? 0), 0) / filteredItems.length
    : 0;
  const filteredSoldRate = filteredItems.length > 0
    ? (filteredItems.filter((item) => item.status === "sold").length / filteredItems.length) * 100
    : 0;

  const customMetricValues: Record<CustomMetricKey, { value: string; detail?: string }> = {
    item_count: { value: String(filteredItems.length), detail: "Matched items" },
    photo_count: { value: String(filteredPhotos.length), detail: "Linked photos" },
    in_stock_value: { value: `¥${filteredInStockValue.toFixed(2)}`, detail: "Owned and in transit" },
    buy_spend: { value: `¥${filteredBuySpend.toFixed(2)}`, detail: "Related buy orders" },
    sales_income: { value: `¥${filteredSalesIncome.toFixed(2)}`, detail: "Completed sales" },
    net_cashflow: { value: `¥${filteredNetCashflow.toFixed(2)}`, detail: "Sales minus buy spend" },
    avg_item_value: { value: `¥${filteredAverageItemValue.toFixed(2)}`, detail: "Average item value" },
    sold_rate: { value: `${filteredSoldRate.toFixed(0)}%`, detail: "Sold items in scope" }
  };

  const statusDistribution = useMemo(() => {
    const labels: Array<CollectionItem["status"]> = ["owned", "in_transit", "sold", "traded"];
    const counts = labels.map((status) => ({
      status,
      count: filteredItems.filter((item) => item.status === status).length
    }));
    const maxCount = Math.max(...counts.map((entry) => entry.count), 1);
    return counts.map((entry) => ({ ...entry, width: `${Math.max(8, (entry.count / maxCount) * 100)}%` }));
  }, [filteredItems]);

  const topTagBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    filteredItems.forEach((item) => {
      item.tagIds.forEach((tagId) => counts.set(tagId, (counts.get(tagId) ?? 0) + 1));
    });
    const maxCount = Math.max(...counts.values(), 1);
    return Array.from(counts.entries())
      .map(([tagId, count]) => ({
        tag: tags.find((entry) => entry.id === tagId),
        count,
        width: `${(count / maxCount) * 100}%`
      }))
      .filter((entry): entry is { tag: Tag; count: number; width: string } => Boolean(entry.tag))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [filteredItems, tags]);

  const priceBands = useMemo(() => {
    const counts = new Map<string, number>();
    filteredItems.forEach((item) => {
      const key = priceBand(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const maxCount = Math.max(...counts.values(), 1);
    return Array.from(counts.entries())
      .map(([band, count]) => ({ band, count, width: `${(count / maxCount) * 100}%` }))
      .sort((left, right) => right.count - left.count);
  }, [filteredItems]);

  const customTimeline = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPurchases.forEach((order) => {
      const key = monthKey(order.paidAt);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    filteredSaleRecords.forEach((record) => {
      const key = monthKey(record.soldAt);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const entries = Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, count]) => ({ month, count }));
    const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
    return entries.map((entry) => ({ ...entry, height: `${28 + (entry.count / maxCount) * 52}px` }));
  }, [filteredPurchases, filteredSaleRecords]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  };

  const toggleMetric = (metric: CustomMetricKey) => {
    setSelectedMetrics((current) => {
      if (current.includes(metric)) {
        return current.length === 1 ? current : current.filter((entry) => entry !== metric);
      }
      return [...current, metric];
    });
  };

  return (
    <Screen title="Analytics" subtitle="Quick readouts for collection size and spend.">
      <Section title="Overview">
        <div className="stats">
          <Stat label="Items" value={String(inStockItems.length)} />
          <Stat label="Item amount" value={`¥${inStockAmount.toFixed(2)}`} />
          <Stat label="Photos" value={String(photoShots.length)} />
          <Stat label="Orders" value={String(allBuyOrders.length + allSaleRecords.length)} />
          <Stat label="Buy orders" value={String(allBuyOrders.length)} />
          <Stat label="Sell orders" value={String(allSaleRecords.length)} />
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
          <Stat label="Sold items" value={String(categorySaleRecords.length)} />
          <Stat label="Total spend" value={`¥${totalSpend.toFixed(2)}`} />
          <Stat label="Buy amount" value={`¥${totalPurchaseAmount.toFixed(2)}`} />
          <Stat label="Buy shipping" value={`¥${totalPurchaseShipping.toFixed(2)}`} />
          <Stat label="Sales" value={`¥${totalSales.toFixed(2)}`} />
          <Stat label="Net income" value={`¥${netSaleIncome.toFixed(2)}`} />
        </div>

        <Card>
          <div className="analytics-panel-head">
            <strong>Activity heat</strong>
            <span className="muted">Buy orders and completed sales by month.</span>
          </div>
          {monthlyActivity.length > 0 ? (
            <div className="heat-strip">
              {monthlyActivity.map((entry) => (
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

      <Section title="Custom analytics" copy="Filter by category and tag, then pick the headline numbers you want to keep on screen.">
        <Card>
          <div className="analytics-filter-grid">
            <div className="filter-group">
              <span className="analytics-filter-label">Key category</span>
              <div className="container-rail single-line analytics-chip-rail">
                <Chip label="All categories" active={customCategoryId === "all"} onClick={() => setCustomCategoryId("all")} />
                {categories.map((category) => (
                  <Chip key={category.id} label={category.name} active={customCategoryId === category.id} onClick={() => setCustomCategoryId(category.id)} />
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="analytics-filter-label">Key tags</span>
              <div className="container-rail single-line analytics-chip-rail">
                {tags.map((tag) => (
                  <Chip key={tag.id} label={tag.name} active={selectedTagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="analytics-filter-label">Metrics to show</span>
              <div className="container-rail single-line analytics-chip-rail">
                {metricOptions.map((metric) => (
                  <Chip key={metric.key} label={metric.label} active={selectedMetrics.includes(metric.key)} onClick={() => toggleMetric(metric.key)} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="stats">
          {selectedMetrics.map((metricKey) => (
            <Stat
              key={metricKey}
              label={metricOptions.find((entry) => entry.key === metricKey)?.label ?? metricKey}
              value={customMetricValues[metricKey].value}
              detail={customMetricValues[metricKey].detail}
            />
          ))}
        </div>

        <div className="card-grid analytics-visual-grid">
          <Card>
            <div className="analytics-panel-head">
              <strong>Status split</strong>
              <span className="muted">{filteredItems.length} items in scope</span>
            </div>
            <div className="analytics-bar-list">
              {statusDistribution.map((entry) => (
                <div className="analytics-bar-row" key={entry.status}>
                  <span>{entry.status.replace("_", " ")}</span>
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill" style={{ width: entry.width }} />
                  </div>
                  <strong>{entry.count}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="analytics-panel-head">
              <strong>Top tags in scope</strong>
              <span className="muted">Which labels appear most often.</span>
            </div>
            {topTagBreakdown.length > 0 ? (
              <div className="analytics-bar-list">
                {topTagBreakdown.map((entry) => (
                  <div className="analytics-bar-row" key={entry.tag.id}>
                    <span>{entry.tag.name}</span>
                    <div className="analytics-bar-track">
                      <div className="analytics-bar-fill warm" style={{ width: entry.width }} />
                    </div>
                    <strong>{entry.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <span className="muted">No matching tags in this scope yet.</span>
            )}
          </Card>

          <Card>
            <div className="analytics-panel-head">
              <strong>Price bands</strong>
              <span className="muted">A quick spread of your item values.</span>
            </div>
            {priceBands.length > 0 ? (
              <div className="analytics-bar-list">
                {priceBands.map((entry) => (
                  <div className="analytics-bar-row" key={entry.band}>
                    <span>{entry.band}</span>
                    <div className="analytics-bar-track">
                      <div className="analytics-bar-fill cool" style={{ width: entry.width }} />
                    </div>
                    <strong>{entry.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <span className="muted">No priced items in this scope yet.</span>
            )}
          </Card>

          <Card>
            <div className="analytics-panel-head">
              <strong>Timeline</strong>
              <span className="muted">Buys and sales touching the current scope.</span>
            </div>
            {customTimeline.length > 0 ? (
              <div className="analytics-mini-timeline">
                {customTimeline.map((entry) => (
                  <div className="analytics-mini-cell" key={entry.month}>
                    <div className="analytics-mini-bar" style={{ height: entry.height }} />
                    <strong>{entry.count}</strong>
                    <span>{entry.month.replace("-", ".")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="muted">No buy or sale timeline in this scope yet.</span>
            )}
          </Card>
        </div>
      </Section>
    </Screen>
  );
}
