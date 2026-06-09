import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
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
  storageMode: "seed" | "local";
  addItem: (draft: DraftItem) => string;
  updateItem: (id: string, patch: Partial<CollectionItem>) => void;
  deleteItem: (id: string) => void;
  addPurchase: (draft: DraftPurchase, itemIds?: string[]) => string;
  addSaleRecord: (draft: DraftSaleRecord) => string;
  linkPurchaseToItem: (purchaseId: string, itemId: string) => void;
  addAlbum: (album: Omit<Album, "id">) => string;
  placeItemInAlbum: (albumId: string, pageIndex: number, row: number, column: number, itemId: string) => void;
  addCategory: (name: string) => string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addField: (field: Omit<CustomField, "id" | "sortOrder">) => string;
  updateField: (id: string, patch: Partial<CustomField>) => void;
  deleteField: (id: string) => void;
  moveField: (fieldId: string, targetIndex: number) => void;
  addTag: (name: string) => string;
  updateTag: (id: string, patch: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  updatePurchase: (id: string, patch: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
};

const CollectionContext = createContext<CollectionState | undefined>(undefined);
const STORAGE_KEY = "collection-app-v0-1";

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type PersistedState = Pick<
  CollectionState,
  "categories" | "fields" | "tags" | "items" | "purchases" | "saleRecords" | "digitalAssets" | "albums" | "albumSlots"
>;

function readPersistedState(): PersistedState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export function CollectionProvider({ children }: PropsWithChildren) {
  const persisted = readPersistedState();
  const [categories, setCategories] = useState(persisted?.categories ?? defaultCategories);
  const [fields, setFields] = useState(persisted?.fields ?? defaultFields);
  const [tags, setTags] = useState(persisted?.tags ?? defaultTags);
  const [items, setItems] = useState(persisted?.items ?? seedItems);
  const [purchases, setPurchases] = useState(persisted?.purchases ?? seedPurchases);
  const [saleRecords, setSaleRecords] = useState(persisted?.saleRecords ?? seedSaleRecords);
  const [digitalAssets] = useState(persisted?.digitalAssets ?? seedDigitalAssets);
  const [albums, setAlbums] = useState(persisted?.albums ?? seedAlbums);
  const [albumSlots, setAlbumSlots] = useState(persisted?.albumSlots ?? seedAlbumSlots);

  useEffect(() => {
    const payload: PersistedState = {
      categories,
      fields,
      tags,
      items,
      purchases,
      saleRecords,
      digitalAssets,
      albums,
      albumSlots
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [albumSlots, albums, categories, digitalAssets, fields, items, purchases, saleRecords, tags]);

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
    storageMode: persisted ? "local" : "seed",
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
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)));
    },
    deleteItem: (id) => {
      setItems((current) => current.filter((item) => item.id !== id));
      setAlbumSlots((current) => current.map((slot) => (slot.itemId === id ? { ...slot, itemId: undefined } : slot)));
    },
    addPurchase: (draft, itemIds = []) => {
      const id = makeId("purchase");
      const purchase: Purchase = {
        id,
        ...draft,
        totalAmount: Number(draft.itemAmount || 0) + Number(draft.shippingAmount || 0)
      };
      setPurchases((current) => [purchase, ...current]);
      if (itemIds.length > 0) {
        setItems((current) =>
          current.map((item) =>
            itemIds.includes(item.id)
              ? {
                  ...item,
                  purchaseId: id,
                  purchaseDate: item.purchaseDate || purchase.paidAt,
                  purchaseAmount: item.purchaseAmount || purchase.totalAmount,
                  updatedAt: new Date().toISOString()
                }
              : item
          )
        );
      }
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
      setItems((current) =>
        current.map((item) => (item.id === draft.itemId ? { ...item, saleRecordId: id, status: "sold", updatedAt: new Date().toISOString() } : item))
      );
      return id;
    },
    linkPurchaseToItem: (purchaseId, itemId) => {
      const purchase = purchases.find((entry) => entry.id === purchaseId);
      if (!purchase) return;
      setItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                purchaseId,
                purchaseDate: item.purchaseDate || purchase.paidAt,
                purchaseAmount: item.purchaseAmount || purchase.totalAmount,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );
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
          return current.map((slot) => (slot.id === existing.id ? { ...slot, itemId } : slot));
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
    },
    addCategory: (name) => {
      const id = makeId("cat");
      setCategories((current) => [...current, { id, name, icon: "CAT", sortOrder: current.length + 1 }]);
      return id;
    },
    updateCategory: (id, patch) => {
      setCategories((current) => current.map((category) => (category.id === id ? { ...category, ...patch } : category)));
    },
    deleteCategory: (id) => {
      setCategories((current) => current.filter((category) => category.id !== id));
      setFields((current) => current.filter((field) => field.categoryId !== id));
    },
    addField: (field) => {
      const id = makeId("field");
      const sortOrder = fields.filter((entry) => entry.categoryId === field.categoryId).length + 1;
      setFields((current) => [...current, { id, sortOrder, ...field }]);
      return id;
    },
    updateField: (id, patch) => {
      setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
    },
    deleteField: (id) => {
      setFields((current) => current.filter((field) => field.id !== id));
      setItems((current) =>
        current.map((item) => {
          const nextValues = { ...item.customValues };
          delete nextValues[id];
          return { ...item, customValues: nextValues };
        })
      );
    },
    moveField: (fieldId, targetIndex) => {
      setFields((current) => {
        const active = current.find((field) => field.id === fieldId);
        if (!active) return current;
        const scoped = current
          .filter((field) => field.categoryId === active.categoryId)
          .sort((left, right) => left.sortOrder - right.sortOrder);
        const moving = scoped.findIndex((field) => field.id === fieldId);
        if (moving < 0) return current;
        const nextScoped = [...scoped];
        const [removed] = nextScoped.splice(moving, 1);
        nextScoped.splice(targetIndex, 0, removed);
        const remapped = new Map(nextScoped.map((field, index) => [field.id, index + 1]));
        return current.map((field) =>
          field.categoryId === active.categoryId ? { ...field, sortOrder: remapped.get(field.id) ?? field.sortOrder } : field
        );
      });
    },
    addTag: (name) => {
      const id = makeId("tag");
      setTags((current) => [...current, { id, name, color: "#2F7D6D" }]);
      return id;
    },
    updateTag: (id, patch) => {
      setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
    },
    deleteTag: (id) => {
      setTags((current) => current.filter((tag) => tag.id !== id));
      setItems((current) => current.map((item) => ({ ...item, tagIds: item.tagIds.filter((tagId) => tagId !== id) })));
    },
    updatePurchase: (id, patch) => {
      setPurchases((current) =>
        current.map((purchase) => {
          if (purchase.id !== id) return purchase;
          const next = { ...purchase, ...patch };
          return {
            ...next,
            totalAmount: Number(next.itemAmount || 0) + Number(next.shippingAmount || 0)
          };
        })
      );
    },
    deletePurchase: (id) => {
      setPurchases((current) => current.filter((purchase) => purchase.id !== id));
      setItems((current) =>
        current.map((item) =>
          item.purchaseId === id
            ? { ...item, purchaseId: undefined, purchaseDate: undefined, purchaseAmount: undefined, updatedAt: new Date().toISOString() }
            : item
        )
      );
    }
  }), [albumSlots, albums, categories, digitalAssets, fields, items, persisted, purchases, saleRecords, tags]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error("useCollection must be used inside CollectionProvider");
  }
  return context;
}
