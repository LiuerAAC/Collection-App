export type ItemStatus = "owned" | "in_transit" | "sold" | "traded" | "wanted";

export type FieldType = "text" | "number" | "money" | "date" | "single" | "multi" | "boolean" | "link";

export type CustomField = {
  id: string;
  categoryId: string;
  name: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  sortOrder: number;
  autocomplete?: boolean;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
};

export type DigitalAsset = {
  id: string;
  itemId: string;
  frontOriginalImage?: string;
  backOriginalImage?: string;
  frontProcessedImage?: string;
  backProcessedImage?: string;
  aspectRatio: string;
  sizeNote?: string;
  status: "missing" | "draft" | "processed";
};

export type CollectionItem = {
  id: string;
  name: string;
  categoryId: string;
  status: ItemStatus;
  description?: string;
  imageUrl?: string;
  tagIds: string[];
  customValues: Record<string, string | number | boolean | string[] | undefined>;
  storageLocation?: string;
  price?: number;
  purchaseDate?: string;
  purchaseAmount?: number;
  purchaseId?: string;
  saleRecordId?: string;
  digitalAssetId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Purchase = {
  id: string;
  merchant: string;
  platform: string;
  paidAt: string;
  title: string;
  orderNo?: string;
  itemAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  sourceLink?: string;
  notes?: string;
};

export type SaleRecord = {
  id: string;
  itemId: string;
  platform: string;
  soldAt: string;
  buyer?: string;
  saleAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string;
};

export type Album = {
  id: string;
  name: string;
  coverColor: string;
  layoutType: "2x2" | "3x3" | "4x3";
  pageCount: number;
  doubleSided: boolean;
};

export type AlbumSlot = {
  id: string;
  albumId: string;
  pageIndex: number;
  side: "front" | "back";
  row: number;
  column: number;
  itemId?: string;
  displaySide: "front" | "back";
};

export type AppTab = "warehouse" | "gallery" | "analytics" | "settings";

export type DraftItem = Pick<CollectionItem, "name" | "categoryId" | "status" | "description" | "imageUrl" | "storageLocation"> & {
  tagIds: string[];
  customValues: CollectionItem["customValues"];
  price?: number;
  purchaseDate?: string;
  purchaseAmount?: number;
};

export type DraftPurchase = Omit<Purchase, "id" | "totalAmount">;

export type DraftSaleRecord = Omit<SaleRecord, "id" | "totalAmount">;
