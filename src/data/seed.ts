import { Album, AlbumSlot, ChecklistList, CollectionItem, DigitalAsset, PhotoShot, Purchase, SaleRecord } from "../types";

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

export const seedPurchases: Purchase[] = [];

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

export const seedPhotoShots: PhotoShot[] = [
  {
    id: "photo-1",
    imageUrl:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1300">
          <defs>
            <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="#d7e9fb"/>
              <stop offset="100%" stop-color="#fff5d0"/>
            </linearGradient>
          </defs>
          <rect width="900" height="1300" fill="url(#bg)"/>
          <rect x="110" y="120" width="680" height="980" rx="44" fill="#b88a53"/>
          <rect x="155" y="165" width="590" height="890" rx="36" fill="#d7b58d"/>
          <rect x="205" y="490" width="230" height="360" rx="26" fill="#643ea9"/>
          <rect x="450" y="560" width="230" height="360" rx="26" fill="#7da9dd"/>
          <circle cx="530" cy="310" r="72" fill="#f7e6a9"/>
          <circle cx="300" cy="1030" r="120" fill="rgba(255,255,255,0.88)"/>
          <text x="452" y="1150" text-anchor="middle" fill="#28496d" font-family="Arial" font-size="54" font-weight="700">Matchday Photo</text>
        </svg>
      `),
    itemIds: ["item-1"],
    title: "Matchday board",
    createdAt: now,
    updatedAt: now
  }
];

export const seedChecklists: ChecklistList[] = [];

export const seedAlbums: Album[] = [
  {
    id: "album-1",
    name: "足球卡册",
    containerType: "album",
    coverColor: "#2F7D6D",
    layoutType: "3x3",
    pageCount: 2,
    doubleSided: true
  },
  {
    id: "album-2",
    name: "精选滑动展示",
    containerType: "slider",
    coverColor: "#4A7DB0",
    layoutType: "3x3",
    pageCount: 1,
    doubleSided: false
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
  },
  {
    id: "slot-2",
    albumId: "album-2",
    pageIndex: 0,
    side: "front",
    row: 0,
    column: 0,
    photoId: "photo-1",
    displaySide: "front"
  }
];
