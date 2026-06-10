import { PendingAssetRecord } from "../types";
import { deleteIndexedRecord, getIndexedRecord, listIndexedKeys, setIndexedRecord } from "./indexedDb";

const ASSET_PREFIX = "pending-asset:";

function assetKey(assetId: string) {
  return `${ASSET_PREFIX}${assetId}`;
}

export async function savePendingAsset(record: PendingAssetRecord) {
  await setIndexedRecord(assetKey(record.id), record);
}

export async function loadPendingAsset(assetId: string) {
  return getIndexedRecord<PendingAssetRecord>(assetKey(assetId));
}

export async function deletePendingAsset(assetId: string) {
  await deleteIndexedRecord(assetKey(assetId));
}

export async function listPendingAssets(ownerScopeKey: string) {
  const keys = await listIndexedKeys(ASSET_PREFIX);
  const records = await Promise.all(keys.map((key) => getIndexedRecord<PendingAssetRecord>(key)));
  return records.reduce<PendingAssetRecord[]>((accumulator, record) => {
    if (record && record.ownerScopeKey === ownerScopeKey) {
      accumulator.push(record);
    }
    return accumulator;
  }, []);
}
