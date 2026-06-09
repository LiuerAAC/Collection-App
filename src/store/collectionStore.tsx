import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { defaultCategories, defaultFields, defaultTags } from "../data/templates";
import { seedAlbumSlots, seedAlbums, seedChecklists, seedDigitalAssets, seedItems, seedPhotoShots, seedPurchases, seedSaleRecords } from "../data/seed";
import {
  Album,
  AlbumSlot,
  Category,
  ChecklistList,
  CollectionItem,
  CustomField,
  DigitalAsset,
  DraftItem,
  DraftPurchase,
  DraftSaleRecord,
  PhotoShot,
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
  photoShots: PhotoShot[];
  checklists: ChecklistList[];
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
  updateAlbum: (id: string, patch: Partial<Album>) => void;
  deleteAlbum: (id: string) => void;
  placeItemInAlbum: (albumId: string, pageIndex: number, row: number, column: number, itemId: string) => void;
  placePhotoInAlbum: (albumId: string, pageIndex: number, row: number, column: number, photoId: string) => void;
  addPhotoShot: (photo: Omit<PhotoShot, "id" | "createdAt" | "updatedAt">) => string;
  updatePhotoShot: (id: string, patch: Partial<PhotoShot>) => void;
  deletePhotoShot: (id: string) => void;
  addChecklist: (seriesName: string, entries: string[]) => string;
  updateChecklist: (id: string, patch: Partial<ChecklistList>) => void;
  deleteChecklist: (id: string) => void;
  setChecklistEntryItems: (checklistId: string, entryId: string, itemIds: string[]) => void;
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
  mergeTags: (sourceTagId: string, targetTagId: string) => void;
  updatePurchase: (id: string, patch: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
};

const CollectionContext = createContext<CollectionState | undefined>(undefined);
const STORAGE_KEY = "collection-app-v0-1";
const ORDER_RESET_MIGRATION_KEY = "collection-app-order-reset-v0-2";

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const computePurchaseTotal = (purchase: Pick<Purchase, "kind" | "itemAmount" | "shippingAmount" | "feeAmount">) =>
  purchase.kind === "sell"
    ? Number(purchase.itemAmount || 0) - Number(purchase.shippingAmount || 0) - Number(purchase.feeAmount || 0)
    : Number(purchase.itemAmount || 0) + Number(purchase.shippingAmount || 0);

const normalizePurchase = (purchase: Partial<Purchase>, fallbackCategoryId: string): Purchase => ({
  id: purchase.id || makeId("purchase"),
  kind: purchase.kind ?? "buy",
  categoryId: purchase.categoryId ?? fallbackCategoryId,
  merchant: purchase.merchant ?? "",
  platform: purchase.platform ?? "CardHobby",
  paidAt: purchase.paidAt ?? "",
  title: purchase.title ?? "",
  orderNo: purchase.orderNo,
  itemAmount: Number(purchase.itemAmount || 0),
  shippingAmount: Number(purchase.shippingAmount || 0),
  feeAmount: Number((purchase as Purchase).feeAmount || 0),
  totalAmount: computePurchaseTotal({
    kind: purchase.kind ?? "buy",
    itemAmount: Number(purchase.itemAmount || 0),
    shippingAmount: Number(purchase.shippingAmount || 0),
    feeAmount: Number((purchase as Purchase).feeAmount || 0)
  }),
  currency: purchase.currency ?? "CNY",
  sourceLink: purchase.sourceLink,
  notes: purchase.notes ?? ""
});

const normalizeChecklistStatus = (checklist: ChecklistList): ChecklistList => {
  const completed = checklist.entries.filter((entry) => entry.itemIds.length > 0).length;
  const shouldFinish = checklist.entries.length > 0 && completed === checklist.entries.length;
  return {
    ...checklist,
    status: shouldFinish ? "finished" : checklist.status === "finished" && !shouldFinish ? "in_progress" : checklist.status
  };
};

type PersistedState = Pick<
  CollectionState,
  "categories" | "fields" | "tags" | "items" | "purchases" | "saleRecords" | "digitalAssets" | "albums" | "albumSlots"
  | "photoShots" | "checklists"
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
    const parsed = JSON.parse(raw) as PersistedState;
    const shouldResetOrders = window.localStorage.getItem(ORDER_RESET_MIGRATION_KEY) !== "done";

    if (!shouldResetOrders) {
      return parsed;
    }

    const nextState: PersistedState = {
      ...parsed,
      purchases: [],
      saleRecords: [],
      items: parsed.items.map((item) => ({
        ...item,
        purchaseId: undefined,
        saleRecordId: undefined,
        purchaseDate: undefined,
        purchaseAmount: undefined
      }))
    };

    return nextState;
  } catch {
    return null;
  }
}

export function CollectionProvider({ children }: PropsWithChildren) {
  const persisted = readPersistedState();
  const fallbackCategoryId = defaultCategories[0]?.id ?? "cat-card";
  const [categories, setCategories] = useState(persisted?.categories ?? defaultCategories);
  const [fields, setFields] = useState(persisted?.fields ?? defaultFields);
  const [tags, setTags] = useState(persisted?.tags ?? defaultTags);
  const [items, setItems] = useState(persisted?.items ?? seedItems);
  const [purchases, setPurchases] = useState((persisted?.purchases ?? seedPurchases).map((purchase) => normalizePurchase(purchase, fallbackCategoryId)));
  const [saleRecords, setSaleRecords] = useState(persisted?.saleRecords ?? seedSaleRecords);
  const [digitalAssets] = useState(persisted?.digitalAssets ?? seedDigitalAssets);
  const [photoShots, setPhotoShots] = useState(persisted?.photoShots ?? seedPhotoShots);
  const [checklists, setChecklists] = useState((persisted?.checklists ?? seedChecklists).map(normalizeChecklistStatus));
  const [albums, setAlbums] = useState(persisted?.albums ?? seedAlbums);
  const [albumSlots, setAlbumSlots] = useState(persisted?.albumSlots ?? seedAlbumSlots);

  useEffect(() => {
    const shouldResetOrders = window.localStorage.getItem(ORDER_RESET_MIGRATION_KEY) !== "done";
    if (!shouldResetOrders) {
      return;
    }

    setPurchases([]);
    setSaleRecords([]);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        purchaseId: undefined,
        saleRecordId: undefined,
        purchaseDate: undefined,
        purchaseAmount: undefined,
        updatedAt: new Date().toISOString()
      }))
    );
    window.localStorage.setItem(ORDER_RESET_MIGRATION_KEY, "done");
  }, []);

  useEffect(() => {
    const payload: PersistedState = {
      categories,
      fields,
      tags,
      items,
      purchases,
      saleRecords,
      digitalAssets,
      photoShots,
      checklists,
      albums,
      albumSlots
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [albumSlots, albums, categories, checklists, digitalAssets, fields, items, photoShots, purchases, saleRecords, tags]);

  const value = useMemo<CollectionState>(() => ({
    categories,
    fields,
    tags,
    items,
    purchases,
    saleRecords,
    digitalAssets,
    photoShots,
    checklists,
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
      setPhotoShots((current) => current.map((photo) => ({ ...photo, itemIds: photo.itemIds.filter((itemId) => itemId !== id) })));
    },
    addPurchase: (draft, itemIds = []) => {
      const id = makeId("purchase");
      const purchase = normalizePurchase(
        {
        id,
        ...draft,
        },
        fallbackCategoryId
      );
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
    updateAlbum: (id, patch) => {
      setAlbums((current) => current.map((album) => (album.id === id ? { ...album, ...patch } : album)));
    },
    deleteAlbum: (id) => {
      setAlbums((current) => current.filter((album) => album.id !== id));
      setAlbumSlots((current) => current.filter((slot) => slot.albumId !== id));
    },
    placeItemInAlbum: (albumId, pageIndex, row, column, itemId) => {
      setAlbumSlots((current) => {
        const existing = current.find((slot) => slot.albumId === albumId && slot.pageIndex === pageIndex && slot.side === "front" && slot.row === row && slot.column === column);
        if (existing) {
          return current.map((slot) => (slot.id === existing.id ? { ...slot, itemId, photoId: undefined } : slot));
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
            photoId: undefined,
            displaySide: "front"
          }
        ];
      });
    },
    placePhotoInAlbum: (albumId, pageIndex, row, column, photoId) => {
      setAlbumSlots((current) => {
        const existing = current.find((slot) => slot.albumId === albumId && slot.pageIndex === pageIndex && slot.side === "front" && slot.row === row && slot.column === column);
        if (existing) {
          return current.map((slot) => (slot.id === existing.id ? { ...slot, photoId, itemId: undefined } : slot));
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
            photoId,
            itemId: undefined,
            displaySide: "front"
          }
        ];
      });
    },
    addPhotoShot: (photo) => {
      const id = makeId("photo");
      const now = new Date().toISOString();
      setPhotoShots((current) => [{ id, createdAt: now, updatedAt: now, ...photo }, ...current]);
      return id;
    },
    updatePhotoShot: (id, patch) => {
      setPhotoShots((current) => current.map((photo) => (photo.id === id ? { ...photo, ...patch, updatedAt: new Date().toISOString() } : photo)));
    },
    deletePhotoShot: (id) => {
      setPhotoShots((current) => current.filter((photo) => photo.id !== id));
      setAlbumSlots((current) => current.map((slot) => (slot.photoId === id ? { ...slot, photoId: undefined } : slot)));
    },
    addChecklist: (seriesName, entries) => {
      const id = makeId("checklist");
      const now = new Date().toISOString();
      const checklist = normalizeChecklistStatus({
        id,
        seriesName,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
        entries: entries
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text) => ({
            id: makeId("check"),
            text,
            itemIds: []
          }))
      });
      setChecklists((current) => [checklist, ...current]);
      return id;
    },
    updateChecklist: (id, patch) => {
      setChecklists((current) =>
        current.map((checklist) => {
          if (checklist.id !== id) return checklist;
          const nextEntries = patch.entries
            ? patch.entries.map((entry) => ({
                ...entry,
                id: entry.id || makeId("check")
              }))
            : checklist.entries;
          return normalizeChecklistStatus({
            ...checklist,
            ...patch,
            entries: nextEntries,
            updatedAt: new Date().toISOString()
          });
        })
      );
    },
    deleteChecklist: (id) => {
      setChecklists((current) => current.filter((checklist) => checklist.id !== id));
    },
    setChecklistEntryItems: (checklistId, entryId, itemIds) => {
      setChecklists((current) =>
        current.map((checklist) => {
          if (checklist.id !== checklistId) return checklist;
          return normalizeChecklistStatus({
            ...checklist,
            updatedAt: new Date().toISOString(),
            entries: checklist.entries.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    itemIds
                  }
                : entry
            )
          });
        })
      );
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
    mergeTags: (sourceTagId, targetTagId) => {
      if (sourceTagId === targetTagId) return;
      setItems((current) =>
        current.map((item) => {
          if (!item.tagIds.includes(sourceTagId)) return item;
          const nextTagIds = item.tagIds
            .filter((tagId) => tagId !== sourceTagId)
            .concat(item.tagIds.includes(targetTagId) ? [] : [targetTagId]);
          return { ...item, tagIds: nextTagIds, updatedAt: new Date().toISOString() };
        })
      );
      setTags((current) => current.filter((tag) => tag.id !== sourceTagId));
    },
    updatePurchase: (id, patch) => {
      setPurchases((current) =>
        current.map((purchase) => {
          if (purchase.id !== id) return purchase;
          return normalizePurchase({ ...purchase, ...patch }, fallbackCategoryId);
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
  }), [albumSlots, albums, categories, checklists, digitalAssets, fields, items, persisted, photoShots, purchases, saleRecords, tags]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error("useCollection must be used inside CollectionProvider");
  }
  return context;
}
