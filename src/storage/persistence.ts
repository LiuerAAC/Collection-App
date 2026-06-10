import { defaultCategories, defaultFields, defaultTags } from "../data/templates";
import { seedAlbumSlots, seedAlbums, seedChecklists, seedDigitalAssets, seedItems, seedPhotoShots, seedPurchases, seedSaleRecords } from "../data/seed";
import { AppStateSnapshot, CloudSyncConfig, SyncQueueEntry } from "../types";
import { getIndexedRecord, setIndexedRecord } from "./indexedDb";

const LEGACY_STORAGE_KEY = "collection-app-v0-1";
const ENVELOPE_KEY = "collection-app-envelope";
const CURRENT_SCHEMA_VERSION = 1;

export type LocalEnvelope = {
  snapshot: AppStateSnapshot;
  syncConfig: CloudSyncConfig;
  syncQueue: SyncQueueEntry[];
  meta: {
    savedAt: string;
    storageMode: "seed" | "migrated" | "local";
  };
};

export function createSeedSnapshot(): AppStateSnapshot {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    categories: defaultCategories,
    fields: defaultFields,
    tags: defaultTags,
    items: seedItems,
    purchases: seedPurchases,
    saleRecords: seedSaleRecords,
    digitalAssets: seedDigitalAssets,
    photoShots: seedPhotoShots,
    checklists: seedChecklists,
    albums: seedAlbums,
    albumSlots: seedAlbumSlots
  };
}

export function createDefaultSyncConfig(): CloudSyncConfig {
  return {
    provider: "none",
    datasetId: "primary",
    autoSync: false,
    autoSyncIntervalMinutes: 10,
    supabaseTable: "collection_snapshots",
    supabaseAssetBucket: "collection-assets",
    assetProvider: "embedded"
  };
}

function envelopeKey(scopeKey: string) {
  return `${ENVELOPE_KEY}:${scopeKey}`;
}

function readLegacyLocalStorageSnapshot() {
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppStateSnapshot>;
    return {
      ...createSeedSnapshot(),
      ...parsed,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString()
    } satisfies AppStateSnapshot;
  } catch {
    return null;
  }
}

export async function loadLocalEnvelope(scopeKey: string) {
  try {
    const persisted = await getIndexedRecord<LocalEnvelope>(envelopeKey(scopeKey));
    if (persisted) {
      return {
        ...persisted,
        syncConfig: {
          ...createDefaultSyncConfig(),
          ...persisted.syncConfig
        }
      };
    }
  } catch {
    // fall through to migration or seed
  }

  const legacySnapshot = readLegacyLocalStorageSnapshot();
  if (legacySnapshot && scopeKey === "guest") {
    const migratedEnvelope: LocalEnvelope = {
      snapshot: legacySnapshot,
      syncConfig: createDefaultSyncConfig(),
      syncQueue: [],
      meta: {
        savedAt: new Date().toISOString(),
        storageMode: "migrated"
      }
    };
    await saveLocalEnvelope(scopeKey, migratedEnvelope);
    return migratedEnvelope;
  }

  return {
    snapshot: createSeedSnapshot(),
    syncConfig: createDefaultSyncConfig(),
    syncQueue: [],
    meta: {
      savedAt: new Date().toISOString(),
      storageMode: "seed"
    }
  } satisfies LocalEnvelope;
}

export async function saveLocalEnvelope(scopeKey: string, envelope: LocalEnvelope) {
  await setIndexedRecord(envelopeKey(scopeKey), envelope);
}
