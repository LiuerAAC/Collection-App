import React, { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";
import { defaultCategories, defaultFields, defaultTags } from "../data/templates";
import { seedAlbumSlots, seedAlbums, seedDigitalAssets, seedItems, seedPurchases, seedSaleRecords } from "../data/seed";
import {
  Album,
  AlbumSlot,
  Category,
  CollectionItem,
  CustomField,
  DigitalAsset,
  DraftItem,
  DraftPurchase,
  DraftSaleRecord,
  Purchase,
  SaleRecord,
  Tag
} from "../types";

type CollectionState = {
  categories: Category[];
  fields: CustomField[];
  tags: Tag[];
  items: CollectionItem[];
  purchases: Purchase[];
  saleRecords: SaleRecord[];
  digitalAssets: DigitalAsset[];
  albums: Album[];
  albumSlots: AlbumSlot[];
  addItem: (draft: DraftItem) => string;
  updateItem: (id: string, patch: Partial<CollectionItem>) => void;
  addPurchase: (draft: DraftPurchase, itemIds: string[]) => string;
  addSaleRecord: (draft: DraftSaleRecord) => string;
  addAlbum: (album: Omit<Album, "id">) => string;
  placeItemInAlbum: (albumId: string, pageIndex: number, row: number, column: number, itemId: string) => void;
};

const CollectionContext = createContext<CollectionState | undefined>(undefined);

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function CollectionProvider({ children }: PropsWithChildren) {
  const [categories] = useState(defaultCategories);
  const [fields] = useState(defaultFields);
  const [tags] = useState(defaultTags);
  const [items, setItems] = useState(seedItems);
  const [purchases, setPurchases] = useState(seedPurchases);
  const [saleRecords, setSaleRecords] = useState(seedSaleRecords);
  const [digitalAssets] = useState(seedDigitalAssets);
  const [albums, setAlbums] = useState(seedAlbums);
  const [albumSlots, setAlbumSlots] = useState(seedAlbumSlots);

  const value = useMemo<CollectionState>(() => ({
    categories,
    fields,
    tags,
    items,
    purchases,
    saleRecords,
    digitalAssets,
    albums,
    albumSlots,
    addItem: (draft) => {
      const id = makeId("item");
      const now = new Date().toISOString();
      setItems((current) => [
        {
          id,
          createdAt: now,
          updatedAt: now,
          ...draft
        },
        ...current
      ]);
      return id;
    },
    updateItem: (id, patch) => {
      setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
    },
    addPurchase: (draft, itemIds) => {
      const id = makeId("purchase");
      const purchase: Purchase = {
        id,
        ...draft,
        totalAmount: Number(draft.itemAmount || 0) + Number(draft.shippingAmount || 0)
      };
      setPurchases((current) => [purchase, ...current]);
      setItems((current) => current.map((item) => itemIds.includes(item.id) ? { ...item, purchaseId: id, updatedAt: new Date().toISOString() } : item));
      return id;
    },
    addSaleRecord: (draft) => {
      const id = makeId("sale");
      const sale: SaleRecord = {
        id,
        ...draft,
        totalAmount: Number(draft.saleAmount || 0) + Number(draft.shippingAmount || 0)
      };
      setSaleRecords((current) => [sale, ...current]);
      setItems((current) => current.map((item) => item.id === draft.itemId ? { ...item, saleRecordId: id, status: "sold", updatedAt: new Date().toISOString() } : item));
      return id;
    },
    addAlbum: (album) => {
      const id = makeId("album");
      setAlbums((current) => [{ id, ...album }, ...current]);
      return id;
    },
    placeItemInAlbum: (albumId, pageIndex, row, column, itemId) => {
      setAlbumSlots((current) => {
        const existing = current.find((slot) => slot.albumId === albumId && slot.pageIndex === pageIndex && slot.side === "front" && slot.row === row && slot.column === column);
        if (existing) {
          return current.map((slot) => slot.id === existing.id ? { ...slot, itemId } : slot);
        }

        return [
          ...current,
          {
            id: makeId("slot"),
            albumId,
            pageIndex,
            side: "front",
            row,
            column,
            itemId,
            displaySide: "front"
          }
        ];
      });
    }
  }), [albumSlots, albums, categories, digitalAssets, fields, items, purchases, saleRecords, tags]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error("useCollection must be used inside CollectionProvider");
  }
  return context;
}

