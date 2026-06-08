import { Album, AlbumSlot, CollectionItem, DigitalAsset, Purchase, SaleRecord } from "../types";

const now = new Date().toISOString();

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
    imageUrl: "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=600",
    tagIds: ["tag-football", "tag-limited"],
    customValues: {
      "field-card-company": "Topps",
      "field-card-series": "Chrome",
      "field-card-year": "2024",
      "field-card-player": "哈兰德",
      "field-card-club": "曼城",
      "field-card-number": "TC-09",
      "field-card-refractor": "Refractor",
      "field-card-limited": " /199",
      "field-card-auto": false,
      "field-card-relic": false,
      "field-card-grade": "Raw"
    },
    storageLocation: "白色卡盒 A / 第 1 排",
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
    createdAt: now,
    updatedAt: now
  }
];

export const seedSaleRecords: SaleRecord[] = [];

export const seedDigitalAssets: DigitalAsset[] = [
  {
    id: "asset-1",
    itemId: "item-1",
    frontOriginalImage: "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=600",
    frontProcessedImage: "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=600",
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

