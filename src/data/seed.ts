import { Album, AlbumSlot, CollectionItem, DigitalAsset, Purchase, SaleRecord } from "../types";

const now = new Date().toISOString();
const cardPreview =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#16372b"/>
          <stop offset="52%" stop-color="#2f7d6d"/>
          <stop offset="100%" stop-color="#d7c2a3"/>
        </linearGradient>
      </defs>
      <rect width="360" height="500" rx="28" fill="url(#g)"/>
      <rect x="26" y="24" width="308" height="452" rx="20" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)"/>
      <circle cx="180" cy="170" r="88" fill="rgba(255,255,255,0.18)"/>
      <text x="180" y="140" text-anchor="middle" fill="#f6f1e8" font-size="26" font-family="Arial">COLLECTION</text>
      <text x="180" y="178" text-anchor="middle" fill="#f6f1e8" font-size="42" font-weight="700" font-family="Arial">9</text>
      <text x="180" y="214" text-anchor="middle" fill="#f6f1e8" font-size="20" font-family="Arial">Haaland</text>
      <rect x="56" y="380" width="248" height="44" rx="14" fill="rgba(18,49,38,0.55)"/>
      <text x="180" y="408" text-anchor="middle" fill="#f6f1e8" font-size="18" font-family="Arial">Topps Chrome Refractor</text>
    </svg>
  `);

export const seedPurchases: Purchase[] = [
  {
    id: "purchase-1",
    merchant: "CardHobby 卖家 A",
    platform: "CardHobby",
    paidAt: "2026-06-01",
    title: "Topps Chrome 足球卡合单",
    orderNo: "CH-DEMO-001",
    itemAmount: 520,
    shippingAmount: 18,
    totalAmount: 538,
    currency: "CNY",
    notes: "v0.1 示例购买记录，可替换为 CardHobby CSV 导入数据"
  }
];

export const seedItems: CollectionItem[] = [
  {
    id: "item-1",
    name: "哈兰德 Topps Chrome Refractor",
    categoryId: "cat-card",
    status: "owned",
    description: "默认卡牌模板示例",
    imageUrl: cardPreview,
    tagIds: ["tag-football", "tag-limited"],
    customValues: {
      "field-card-company": "Topps",
      "field-card-series": "Chrome",
      "field-card-year": "2024",
      "field-card-player": "哈兰德",
      "field-card-club": "曼城",
      "field-card-number": "TC-09",
      "field-card-refractor": "Refractor",
      "field-card-special": "Topps Chrome Refractor",
      "field-card-serial-enabled": true,
      "field-card-serial-number": "/199",
      "field-card-relic": false,
      "field-card-auto": false,
      "field-card-oversize": false
    },
    storageLocation: "白色卡盒 A / 第 1 排",
    price: 132,
    purchaseAmount: 132,
    purchaseDate: "2026-06-01",
    purchaseId: "purchase-1",
    digitalAssetId: "asset-1",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item-2",
    name: "自制球队徽章",
    categoryId: "cat-badge",
    status: "owned",
    description: "跨品类 tag 示例",
    tagIds: ["tag-football", "tag-favorite"],
    customValues: {
      "field-badge-theme": "足球",
      "field-badge-craft": "滴胶",
      "field-badge-size": "58mm"
    },
    storageLocation: "抽屉 B / 徽章收纳册",
    price: 88,
    createdAt: now,
    updatedAt: now
  }
];

export const seedSaleRecords: SaleRecord[] = [];

export const seedDigitalAssets: DigitalAsset[] = [
  {
    id: "asset-1",
    itemId: "item-1",
    frontOriginalImage: cardPreview,
    frontProcessedImage: cardPreview,
    aspectRatio: "2.5:3.5",
    sizeNote: "标准卡尺寸",
    status: "processed"
  }
];

export const seedAlbums: Album[] = [
  {
    id: "album-1",
    name: "足球卡册",
    coverColor: "#2F7D6D",
    layoutType: "3x3",
    pageCount: 2,
    doubleSided: true
  }
];

export const seedAlbumSlots: AlbumSlot[] = [
  {
    id: "slot-1",
    albumId: "album-1",
    pageIndex: 0,
    side: "front",
    row: 0,
    column: 0,
    itemId: "item-1",
    displaySide: "front"
  }
];
