import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabaseRuntimeConfig } from "../config";
import { defaultCategories } from "../data/templates";
import { pullSnapshotFromSupabase, prepareSnapshotForCloud, pushSnapshotToSupabase, uploadPendingAssets } from "../storage/cloudSync";
import { savePendingAsset } from "../storage/localAssets";
import { createDefaultSyncConfig, createSeedSnapshot, loadLocalEnvelope, saveLocalEnvelope } from "../storage/persistence";
import {
  Album,
  AlbumSlot,
  AppStateSnapshot,
  Category,
  ChecklistList,
  CloudSyncConfig,
  CollectionItem,
  CustomField,
  DigitalAsset,
  DraftItem,
  DraftPurchase,
  DraftSaleRecord,
  PendingAssetRecord,
  PhotoShot,
  Purchase,
  SaleRecord,
  StorageStatus,
  SyncQueueEntry,
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
  storageStatus: StorageStatus;
  syncConfig: CloudSyncConfig;
  storageScopeKey: string;
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
  updateSyncConfig: (patch: Partial<CloudSyncConfig>) => void;
  stageLocalImage: (target: "item" | "photo", file: File) => Promise<{ assetId: string; previewUrl: string }>;
  exportBackup: () => void;
  pushToCloud: () => Promise<void>;
  pullFromCloud: () => Promise<void>;
};

const CollectionContext = createContext<CollectionState | undefined>(undefined);

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const LOCAL_PREVIEW_MAX_WIDTH = 420;
const LOCAL_PREVIEW_QUALITY = 0.72;
const CLOUD_IMAGE_MAX_WIDTH = 1080;
const CLOUD_IMAGE_QUALITY = 0.78;

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

async function makeImageBlob(file: File, maxWidth: number, quality = 0.82) {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / imageBitmap.width);
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("preview canvas unavailable");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(imageBitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }
      reject(new Error("preview generation failed"));
    }, "image/jpeg", quality);
  });
  imageBitmap.close();
  return blob;
}
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

function cloudSyncErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Cloud sync failed.";
  const normalized = message.toLowerCase();
  if (["failed to fetch", "load failed", "network", "timed out", "timeout"].some((pattern) => normalized.includes(pattern))) {
    return "Cloud request failed on this device. Check network/VPN, then try Push or Pull again.";
  }
  return message;
}

const IMAGE_CACHE_NAME = "collection-app-images-v0-1";
const RECENT_IMAGE_PREFETCH_LIMIT = 80;

function collectRecentImageUrls(snapshot: AppStateSnapshot) {
  const itemUrls = snapshot.items
    .filter((item) => item.imageUrl || item.imageThumbUrl)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .flatMap((item) => [item.imageThumbUrl, item.imageUrl].filter(Boolean) as string[]);
  const photoUrls = snapshot.photoShots
    .filter((photo) => photo.imageUrl || photo.imageThumbUrl)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .flatMap((photo) => [photo.imageThumbUrl, photo.imageUrl].filter(Boolean) as string[]);
  return Array.from(new Set([...photoUrls, ...itemUrls])).slice(0, RECENT_IMAGE_PREFETCH_LIMIT);
}

async function prefetchImageUrls(urls: string[], onProgress?: (completed: number, total: number) => void) {
  if (!("caches" in window) || urls.length === 0) {
    return;
  }

  const cache = await window.caches.open(IMAGE_CACHE_NAME);
  let completed = 0;
  const workerCount = Math.min(4, urls.length);
  let cursor = 0;
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < urls.length) {
      const index = cursor;
      cursor += 1;
      const url = urls[index];
      try {
        const request = new Request(url, { mode: "no-cors" });
        const cached = await cache.match(request);
        if (!cached) {
          const response = await fetch(request);
          await cache.put(request, response);
        }
      } catch {
        // Image prefetch is an optimization; rendering can still load directly.
      } finally {
        completed += 1;
        onProgress?.(completed, urls.length);
      }
    }
  });

  await Promise.all(workers);
}

export function CollectionProvider({ children }: PropsWithChildren) {
  const { session, user } = useAuth();
  const seedSnapshot = createSeedSnapshot();
  const fallbackCategoryId = defaultCategories[0]?.id ?? "cat-card";
  const storageScopeKey = user?.id ?? "guest";
  const [categories, setCategories] = useState(seedSnapshot.categories);
  const [fields, setFields] = useState(seedSnapshot.fields);
  const [tags, setTags] = useState(seedSnapshot.tags);
  const [items, setItems] = useState(seedSnapshot.items);
  const [purchases, setPurchases] = useState(seedSnapshot.purchases.map((purchase) => normalizePurchase(purchase, fallbackCategoryId)));
  const [saleRecords, setSaleRecords] = useState(seedSnapshot.saleRecords);
  const [digitalAssets, setDigitalAssets] = useState(seedSnapshot.digitalAssets);
  const [photoShots, setPhotoShots] = useState(seedSnapshot.photoShots);
  const [checklists, setChecklists] = useState(seedSnapshot.checklists.map(normalizeChecklistStatus));
  const [albums, setAlbums] = useState(seedSnapshot.albums);
  const [albumSlots, setAlbumSlots] = useState(seedSnapshot.albumSlots);
  const [syncConfig, setSyncConfig] = useState(createDefaultSyncConfig());
  const [syncQueue, setSyncQueue] = useState<SyncQueueEntry[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    ready: false,
    storageBackend: "indexeddb",
    storageMode: "seed",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingSyncCount: 0,
    syncInFlight: false
  });
  const snapshotChangeGuard = useRef(true);
  const cloudBootstrapKey = useRef<string | null>(null);
  const syncQueueLength = useRef(0);
  const prefetchKey = useRef("");
  const createManagedSyncConfig = () => {
    const next = createDefaultSyncConfig();
    if (supabaseRuntimeConfig.url && supabaseRuntimeConfig.anonKey) {
      next.provider = "supabase";
      next.supabaseUrl = supabaseRuntimeConfig.url;
      next.supabaseAnonKey = supabaseRuntimeConfig.anonKey;
      next.supabaseAssetBucket = supabaseRuntimeConfig.storageBucket;
      next.assetProvider = "supabase_storage";
    }
    if (user?.id) {
      next.datasetId = user.id;
    }
    return next;
  };

  const applySnapshot = (snapshot: AppStateSnapshot) => {
    setCategories(snapshot.categories);
    setFields(snapshot.fields);
    setTags(snapshot.tags);
    setItems(snapshot.items);
    setPurchases(snapshot.purchases.map((purchase) => normalizePurchase(purchase, fallbackCategoryId)));
    setSaleRecords(snapshot.saleRecords);
    setDigitalAssets(snapshot.digitalAssets);
    setPhotoShots(snapshot.photoShots);
    setChecklists(snapshot.checklists.map(normalizeChecklistStatus));
    setAlbums(snapshot.albums);
    setAlbumSlots(snapshot.albumSlots);
  };

  useEffect(() => {
    let cancelled = false;

    snapshotChangeGuard.current = true;

    loadLocalEnvelope(storageScopeKey).then((envelope) => {
      if (cancelled) return;
      snapshotChangeGuard.current = true;
      applySnapshot(envelope.snapshot);
      setSyncConfig({
        ...envelope.syncConfig,
        ...createManagedSyncConfig()
      });
      setSyncQueue(envelope.syncQueue);
      setStorageStatus((current) => ({
        ...current,
        ready: true,
        storageMode: envelope.meta.storageMode,
        pendingSyncCount: envelope.syncQueue.length
      }));
    }).catch(() => {
      if (cancelled) return;
      setStorageStatus((current) => ({
        ...current,
        ready: true,
        storageMode: "seed",
        lastError: "Local storage initialization failed."
      }));
    });

    const onNetworkChange = () => {
      setStorageStatus((current) => ({ ...current, online: navigator.onLine }));
    };

    window.addEventListener("online", onNetworkChange);
    window.addEventListener("offline", onNetworkChange);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onNetworkChange);
      window.removeEventListener("offline", onNetworkChange);
    };
  }, [storageScopeKey]);

  const snapshot = useMemo<AppStateSnapshot>(() => ({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
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
  }), [albumSlots, albums, categories, checklists, digitalAssets, fields, items, photoShots, purchases, saleRecords, tags]);

  useEffect(() => {
    if (!storageStatus.ready) {
      return;
    }

    saveLocalEnvelope(storageScopeKey, {
      snapshot,
      syncConfig,
      syncQueue,
      meta: {
        savedAt: new Date().toISOString(),
        storageMode: storageStatus.storageMode === "seed" ? "local" : storageStatus.storageMode
      }
    }).catch(() => undefined);
  }, [snapshot, storageScopeKey, storageStatus.ready, storageStatus.storageMode, syncConfig, syncQueue]);

  useEffect(() => {
    if (!storageStatus.ready) {
      return;
    }

    if (snapshotChangeGuard.current) {
      snapshotChangeGuard.current = false;
      return;
    }

    setSyncQueue((current) =>
      current.length > 0
        ? current
        : [
            {
              id: makeId("sync"),
              type: "push",
              reason: "local-change",
              createdAt: new Date().toISOString(),
              tries: 0
            }
          ]
    );
  }, [snapshot, storageStatus.ready]);

  useEffect(() => {
    syncQueueLength.current = syncQueue.length;
    setStorageStatus((current) => ({
      ...current,
      pendingSyncCount: syncQueue.length
    }));
  }, [syncQueue.length]);

  useEffect(() => {
    if (!storageStatus.ready || !storageStatus.online || syncConfig.provider !== "supabase" || !session?.accessToken) {
      return;
    }

    const bootstrapKey = `${storageScopeKey}:${syncConfig.datasetId}`;
    if (cloudBootstrapKey.current === bootstrapKey) {
      return;
    }

    let cancelled = false;
    cloudBootstrapKey.current = bootstrapKey;
    setStorageStatus((current) => ({
      ...current,
      syncInFlight: true,
      syncAction: "pull",
      lastError: undefined
    }));

    pullSnapshotFromSupabase(syncConfig, session.accessToken).then((remote) => {
      if (cancelled) return;

      if (!remote) {
        setStorageStatus((current) => ({
          ...current,
          syncInFlight: false,
          syncAction: undefined,
          cloudSyncChecked: true
        }));
        return;
      }

      const hasPendingLocalChanges = syncQueueLength.current > 0;
      if (!hasPendingLocalChanges) {
        snapshotChangeGuard.current = true;
        applySnapshot(remote.payload);
      }

      setStorageStatus((current) => ({
        ...current,
        syncInFlight: false,
        syncAction: undefined,
        lastSyncAction: hasPendingLocalChanges ? current.lastSyncAction : "pull",
        lastSyncedAt: remote.updated_at,
        cloudSyncChecked: true,
        lastError: undefined
      }));
    }).catch((error) => {
      if (cancelled) return;
      cloudBootstrapKey.current = null;
      setStorageStatus((current) => ({
        ...current,
        syncInFlight: false,
        syncAction: undefined,
        lastError: cloudSyncErrorMessage(error)
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [storageStatus.ready, storageStatus.online, syncConfig, session?.accessToken, storageScopeKey, syncQueue.length]);

  const pushToCloud = async () => {
    if (syncConfig.provider !== "supabase") {
      setStorageStatus((current) => ({ ...current, lastError: "Choose Supabase before syncing." }));
      return;
    }
    if (!session?.accessToken) {
      setStorageStatus((current) => ({ ...current, lastError: "Sign in before syncing with Supabase." }));
      return;
    }

    setStorageStatus((current) => ({ ...current, syncInFlight: true, syncAction: "push", lastError: undefined }));
    try {
      const withUploadedAssets = await uploadPendingAssets(syncConfig, snapshot, storageScopeKey, session.accessToken, (completed, total) => {
        setStorageStatus((current) => ({
          ...current,
          photoSyncPhase: "uploading",
          photoSyncCompleted: completed,
          photoSyncTotal: total
        }));
      });
      const preparedSnapshot = await prepareSnapshotForCloud(syncConfig, withUploadedAssets, session.accessToken);
      const syncedAt = await pushSnapshotToSupabase(syncConfig, preparedSnapshot, session.accessToken);
      snapshotChangeGuard.current = true;
      applySnapshot(preparedSnapshot);
      setSyncQueue([]);
      setStorageStatus((current) => ({
        ...current,
        syncInFlight: false,
        syncAction: undefined,
        lastSyncAction: "push",
        lastSyncedAt: syncedAt,
        cloudSyncChecked: true,
        photoSyncPhase: undefined,
        photoSyncCompleted: undefined,
        photoSyncTotal: undefined,
        lastError: undefined
      }));
    } catch (error) {
      const message = cloudSyncErrorMessage(error);
      setSyncQueue((current) =>
        current.map((entry) =>
          entry.type === "push"
            ? {
                ...entry,
                tries: entry.tries + 1,
                lastError: message
              }
            : entry
        )
      );
      setStorageStatus((current) => ({
        ...current,
        syncInFlight: false,
        syncAction: undefined,
        photoSyncPhase: undefined,
        lastError: message
      }));
    }
  };

  const pullFromCloud = async () => {
    if (syncConfig.provider !== "supabase") {
      setStorageStatus((current) => ({ ...current, lastError: "Choose Supabase before pulling cloud data." }));
      return;
    }
    if (!session?.accessToken) {
      setStorageStatus((current) => ({ ...current, lastError: "Sign in before pulling cloud data." }));
      return;
    }

    setStorageStatus((current) => ({ ...current, syncInFlight: true, syncAction: "pull", lastError: undefined }));
    try {
      const remote = await pullSnapshotFromSupabase(syncConfig, session.accessToken);
      if (!remote) {
        setStorageStatus((current) => ({
          ...current,
          syncInFlight: false,
          syncAction: undefined,
          cloudSyncChecked: true,
          lastError: "No cloud dataset was found yet."
        }));
        return;
      }
      snapshotChangeGuard.current = true;
      applySnapshot(remote.payload);
      setSyncQueue([]);
      setStorageStatus((current) => ({
        ...current,
        syncInFlight: false,
        syncAction: undefined,
        lastSyncAction: "pull",
        lastSyncedAt: remote.updated_at,
        cloudSyncChecked: true,
        lastError: undefined
      }));
    } catch (error) {
      setStorageStatus((current) => ({
        ...current,
        syncInFlight: false,
        syncAction: undefined,
        lastError: cloudSyncErrorMessage(error)
      }));
    }
  };

  useEffect(() => {
    if (!storageStatus.ready || !storageStatus.online || syncConfig.provider !== "supabase" || syncQueue.length === 0 || storageStatus.syncInFlight || !session?.accessToken) {
      return;
    }

    const timer = window.setTimeout(() => {
      void pushToCloud();
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [
    snapshot,
    storageStatus.ready,
    storageStatus.online,
    storageStatus.syncInFlight,
    syncConfig.provider,
    session?.accessToken,
    syncQueue.length
  ]);

  useEffect(() => {
    if (!storageStatus.ready || !storageStatus.online) {
      return;
    }

    const urls = collectRecentImageUrls(snapshot);
    const nextKey = urls.join("|");
    if (!nextKey || prefetchKey.current === nextKey) {
      return;
    }

    let cancelled = false;
    prefetchKey.current = nextKey;
    setStorageStatus((current) => ({
      ...current,
      photoSyncPhase: "prefetching",
      photoSyncCompleted: 0,
      photoSyncTotal: urls.length
    }));

    prefetchImageUrls(urls, (completed, total) => {
      if (cancelled) return;
      setStorageStatus((current) => ({
        ...current,
        photoSyncPhase: "prefetching",
        photoSyncCompleted: completed,
        photoSyncTotal: total
      }));
    }).finally(() => {
      if (cancelled) return;
      setStorageStatus((current) => ({
        ...current,
        photoSyncPhase: undefined,
        photoSyncCompleted: undefined,
        photoSyncTotal: undefined
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [snapshot, storageStatus.ready, storageStatus.online]);

  const stageLocalImage = async (target: "item" | "photo", file: File) => {
    let previewUrl = "";
    let uploadBlob: Blob = file;
    let thumbBlob: Blob | undefined;
    try {
      thumbBlob = await makeImageBlob(file, LOCAL_PREVIEW_MAX_WIDTH, LOCAL_PREVIEW_QUALITY);
      previewUrl = await fileToDataUrl(thumbBlob);
      uploadBlob = await makeImageBlob(file, CLOUD_IMAGE_MAX_WIDTH, CLOUD_IMAGE_QUALITY);
    } catch {
      previewUrl = await fileToDataUrl(file);
    }
    const assetId = makeId("asset");
    const pendingAsset: PendingAssetRecord = {
      id: assetId,
      ownerScopeKey: storageScopeKey,
      target,
      mimeType: uploadBlob.type || file.type || "image/jpeg",
      fileName: uploadBlob === file ? file.name || `${assetId}.jpg` : `${assetId}.jpg`,
      blob: uploadBlob,
      thumbBlob,
      createdAt: new Date().toISOString()
    };
    await savePendingAsset(pendingAsset);
    return { assetId, previewUrl };
  };

  const exportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      scopeKey: storageScopeKey,
      userEmail: user?.email,
      snapshot,
      syncConfig: {
        ...syncConfig,
        supabaseAnonKey: undefined
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `collection-backup-${storageScopeKey}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
    storageStatus,
    syncConfig,
    storageScopeKey,
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
    },
    updateSyncConfig: (patch) => {
      setSyncConfig((current) => ({
        ...current,
        ...patch,
        ...(supabaseRuntimeConfig.url ? { provider: "supabase" as const, supabaseUrl: supabaseRuntimeConfig.url } : {}),
        ...(supabaseRuntimeConfig.anonKey ? { supabaseAnonKey: supabaseRuntimeConfig.anonKey } : {}),
        ...(supabaseRuntimeConfig.storageBucket ? { supabaseAssetBucket: supabaseRuntimeConfig.storageBucket, assetProvider: "supabase_storage" as const } : {}),
        ...(user?.id ? { datasetId: user.id } : {})
      }));
    },
    stageLocalImage,
    exportBackup,
    pushToCloud,
    pullFromCloud
  }), [albumSlots, albums, categories, checklists, digitalAssets, fields, items, photoShots, purchases, saleRecords, tags, storageScopeKey, storageStatus, syncConfig, snapshot, user?.email, user?.id, session?.accessToken]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error("useCollection must be used inside CollectionProvider");
  }
  return context;
}
