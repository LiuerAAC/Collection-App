import { AppStateSnapshot, CloudSyncConfig, PendingAssetRecord } from "../types";
import { deletePendingAsset, loadPendingAsset } from "./localAssets";

type SupabaseRecord = {
  dataset_id: string;
  payload: AppStateSnapshot;
  app_version: string;
  updated_at: string;
};

function ensureSupabaseConfig(config: CloudSyncConfig) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase URL and anon key are required.");
  }
}

function supabaseHeaders(config: CloudSyncConfig, contentType = "application/json", accessToken?: string) {
  ensureSupabaseConfig(config);
  return {
    apikey: config.supabaseAnonKey as string,
    Authorization: `Bearer ${accessToken || config.supabaseAnonKey}`,
    "Content-Type": contentType
  };
}

function buildSupabaseUrl(config: CloudSyncConfig, path: string) {
  return `${config.supabaseUrl?.replace(/\/$/, "")}${path}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isTransientFetchError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return ["failed to fetch", "load failed", "network", "timed out", "timeout"].some((pattern) => message.includes(pattern));
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (!isTransientFetchError(error) || attempt === attempts - 1) {
        break;
      }
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network request failed.");
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, data] = dataUrl.split(",");
  if (!meta || typeof data === "undefined") {
    throw new Error("Invalid data URL.");
  }

  const mime = meta.match(/data:(.*?)(;|$)/u)?.[1] ?? "application/octet-stream";

  if (meta.includes(";base64")) {
    const binary = window.atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  }

  return new Blob([decodeURIComponent(data)], { type: mime });
}

function dataUrlExtension(dataUrl: string) {
  const meta = dataUrl.split(",")[0] ?? "";
  const mime = meta.match(/data:(.*?)(;|$)/u)?.[1] ?? "application/octet-stream";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

async function uploadBlobToSupabaseStorage(config: CloudSyncConfig, assetPath: string, blob: Blob, accessToken?: string) {
  const bucket = config.supabaseAssetBucket || "collection-assets";
  const response = await fetchWithRetry(buildSupabaseUrl(config, `/storage/v1/object/${bucket}/${assetPath}`), {
    method: "POST",
    headers: supabaseHeaders(config, blob.type, accessToken),
    body: blob
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase storage upload failed for ${assetPath}: ${response.status}${detail ? ` - ${detail}` : ""}`);
  }
  return buildSupabaseUrl(config, `/storage/v1/object/public/${bucket}/${assetPath}`);
}

async function uploadToSupabaseStorage(config: CloudSyncConfig, assetPath: string, dataUrl: string, accessToken?: string) {
  return uploadBlobToSupabaseStorage(config, assetPath, dataUrlToBlob(dataUrl), accessToken);
}

async function uploadToCloudflareWorker(config: CloudSyncConfig, assetPath: string, dataUrl: string) {
  if (!config.cloudflareUploadUrl) {
    throw new Error("Cloudflare upload URL is required.");
  }
  const response = await fetchWithRetry(config.cloudflareUploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      datasetId: config.datasetId,
      path: assetPath,
      dataUrl
    })
  });
  if (!response.ok) {
    throw new Error(`Cloudflare upload failed: ${response.status}`);
  }
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error("Cloudflare upload did not return a public URL.");
  }
  return payload.url;
}

async function offloadAsset(config: CloudSyncConfig, assetPath: string, dataUrl: string, accessToken?: string) {
  if (config.assetProvider === "supabase_storage") {
    return uploadToSupabaseStorage(config, assetPath, dataUrl, accessToken);
  }
  if (config.assetProvider === "cloudflare_worker") {
    return uploadToCloudflareWorker(config, assetPath, dataUrl);
  }
  return dataUrl;
}

export async function prepareSnapshotForCloud(config: CloudSyncConfig, snapshot: AppStateSnapshot, accessToken?: string) {
  if (config.assetProvider === "embedded") {
    return snapshot;
  }

  const items = await Promise.all(
    snapshot.items.map(async (item) => {
      // Keep built-in/demo embedded data URLs inside the snapshot. Real user uploads
      // are staged with imageAssetId and already handled by uploadPendingAssets().
      if (!item.imageUrl?.startsWith("data:") || !item.imageAssetId) {
        return item;
      }
      const remoteUrl = await offloadAsset(config, `${config.datasetId}/items/${item.id}.${dataUrlExtension(item.imageUrl)}`, item.imageUrl, accessToken);
      return { ...item, imageUrl: remoteUrl, imageAssetId: undefined };
    })
  );

  const photoShots = await Promise.all(
    snapshot.photoShots.map(async (photo) => {
      if (!photo.imageUrl.startsWith("data:") || !photo.imageAssetId) {
        return photo;
      }
      const remoteUrl = await offloadAsset(config, `${config.datasetId}/photos/${photo.id}.${dataUrlExtension(photo.imageUrl)}`, photo.imageUrl, accessToken);
      return { ...photo, imageUrl: remoteUrl, imageAssetId: undefined };
    })
  );

  return {
    ...snapshot,
    items,
    photoShots,
    updatedAt: new Date().toISOString()
  } satisfies AppStateSnapshot;
}

function sanitizeSnapshot(snapshot: AppStateSnapshot): AppStateSnapshot {
  return {
    ...snapshot,
    items: snapshot.items.map((item) => ({
      ...item,
      localPreviewUrl: undefined,
      imageAssetId: undefined
    })),
    photoShots: snapshot.photoShots.map((photo) => ({
      ...photo,
      localPreviewUrl: undefined,
      imageAssetId: undefined
    }))
  };
}

function fileExtension(record: PendingAssetRecord) {
  const source = record.fileName.split(".").pop()?.toLowerCase();
  if (source && source.length <= 5) {
    return source;
  }
  if (record.mimeType === "image/png") return "png";
  if (record.mimeType === "image/webp") return "webp";
  return "jpg";
}

function blobExtension(blob: Blob) {
  if (blob.type === "image/png") return "png";
  if (blob.type === "image/webp") return "webp";
  if (blob.type === "image/svg+xml") return "svg";
  if (blob.type === "image/gif") return "gif";
  return "jpg";
}

async function optimizeImageBlob(blob: Blob, maxWidth = 1080, quality = 0.78) {
  if (!blob.type.startsWith("image/") || blob.type === "image/svg+xml" || blob.type === "image/gif") {
    return { blob, extension: blobExtension(blob) };
  }

  try {
    const imageBitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / imageBitmap.width);
    const width = Math.max(1, Math.round(imageBitmap.width * scale));
    const height = Math.max(1, Math.round(imageBitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      imageBitmap.close();
      return { blob, extension: blobExtension(blob) };
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(imageBitmap, 0, 0, width, height);
    imageBitmap.close();

    const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }
        reject(new Error("image optimization failed"));
      }, "image/jpeg", quality);
    });

    if (optimizedBlob.size >= blob.size) {
      return { blob, extension: blobExtension(blob) };
    }

    return { blob: optimizedBlob, extension: "jpg" };
  } catch {
    return { blob, extension: blobExtension(blob) };
  }
}

export async function uploadPendingAssets(
  config: CloudSyncConfig,
  snapshot: AppStateSnapshot,
  ownerScopeKey: string,
  accessToken?: string,
  onProgress?: (completed: number, total: number) => void
) {
  if (config.assetProvider !== "supabase_storage") {
    return snapshot;
  }

  const pendingIds = new Set<string>();
  snapshot.items.forEach((item) => {
    if (item.imageAssetId) {
      pendingIds.add(item.imageAssetId);
    }
  });
  snapshot.photoShots.forEach((photo) => {
    if (photo.imageAssetId) {
      pendingIds.add(photo.imageAssetId);
    }
  });

  if (pendingIds.size === 0) {
    return snapshot;
  }

  const assetEntries = await Promise.all(Array.from(pendingIds).map(async (assetId) => [assetId, await loadPendingAsset(assetId)] as const));
  const resolvedEntries = assetEntries.reduce<Array<readonly [string, PendingAssetRecord]>>((accumulator, entry) => {
    const record = entry[1];
    if (record && record.ownerScopeKey === ownerScopeKey) {
      accumulator.push([entry[0], record] as const);
    }
    return accumulator;
  }, []);
  const assetMap = new Map<string, PendingAssetRecord>(resolvedEntries);

  const uploadedPaths = new Map<string, { fullUrl: string; thumbUrl?: string }>();
  let completed = 0;
  for (const [assetId, record] of assetMap) {
    const optimized = await optimizeImageBlob(record.blob);
    const suffix = Date.now();
    const objectPath = `${config.datasetId}/${record.target}s/${assetId}-${suffix}.${optimized.extension || fileExtension(record)}`;
    const fullUrl = await uploadBlobToSupabaseStorage(config, objectPath, optimized.blob, accessToken);
    const thumbSource = record.thumbBlob ?? (await optimizeImageBlob(record.blob, 420, 0.72)).blob;
    const thumb = await optimizeImageBlob(thumbSource, 420, 0.72);
    const thumbPath = `${config.datasetId}/${record.target}s/thumbs/${assetId}-${suffix}.${thumb.extension || "jpg"}`;
    const thumbUrl = await uploadBlobToSupabaseStorage(config, thumbPath, thumb.blob, accessToken);
    uploadedPaths.set(assetId, { fullUrl, thumbUrl });
    await deletePendingAsset(assetId);
    completed += 1;
    onProgress?.(completed, assetMap.size);
  }

  return {
    ...snapshot,
    items: snapshot.items.map((item) =>
      item.imageAssetId && uploadedPaths.has(item.imageAssetId)
        ? {
            ...item,
            imageUrl: uploadedPaths.get(item.imageAssetId)?.fullUrl,
            imageThumbUrl: uploadedPaths.get(item.imageAssetId)?.thumbUrl,
            localPreviewUrl: item.localPreviewUrl || item.imageUrl,
            imageAssetId: undefined,
            updatedAt: new Date().toISOString()
          }
        : item
    ),
    photoShots: snapshot.photoShots.map((photo) =>
      photo.imageAssetId && uploadedPaths.has(photo.imageAssetId)
        ? {
            ...photo,
            imageUrl: uploadedPaths.get(photo.imageAssetId)?.fullUrl as string,
            imageThumbUrl: uploadedPaths.get(photo.imageAssetId)?.thumbUrl,
            localPreviewUrl: photo.localPreviewUrl || photo.imageUrl,
            imageAssetId: undefined,
            updatedAt: new Date().toISOString()
          }
        : photo
    ),
    updatedAt: new Date().toISOString()
  } satisfies AppStateSnapshot;
}

export async function pushSnapshotToSupabase(config: CloudSyncConfig, snapshot: AppStateSnapshot, accessToken?: string) {
  ensureSupabaseConfig(config);
  const table = config.supabaseTable || "collection_snapshots";
  const record: SupabaseRecord = {
    dataset_id: config.datasetId,
    payload: sanitizeSnapshot(snapshot),
    app_version: "1.0.0",
    updated_at: new Date().toISOString()
  };

  const response = await fetchWithRetry(buildSupabaseUrl(config, `/rest/v1/${table}?on_conflict=dataset_id`), {
    method: "POST",
    headers: {
      ...supabaseHeaders(config, "application/json", accessToken),
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify([record])
  });

  if (!response.ok) {
    throw new Error(`Supabase snapshot push failed: ${response.status}`);
  }

  return record.updated_at;
}

export async function pullSnapshotFromSupabase(config: CloudSyncConfig, accessToken?: string) {
  ensureSupabaseConfig(config);
  const table = config.supabaseTable || "collection_snapshots";
  const response = await fetchWithRetry(
    buildSupabaseUrl(
      config,
      `/rest/v1/${table}?dataset_id=eq.${encodeURIComponent(config.datasetId)}&select=payload,updated_at&limit=1`
    ),
    {
      headers: supabaseHeaders(config, "application/json", accessToken)
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase snapshot pull failed: ${response.status}`);
  }

  const payload = (await response.json()) as Array<{ payload: AppStateSnapshot; updated_at: string }>;
  return payload[0] ?? null;
}
