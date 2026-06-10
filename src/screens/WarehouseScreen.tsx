import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Chip, EmptyState, Field, IconButton, Row, Screen, Section, Stack } from "../components/ui";
import { useCollection } from "../store/collectionStore";
import { ChecklistEntry, ChecklistList, ChecklistStatus, CollectionItem, CustomField, DraftItem, DraftPurchase, ItemStatus, OrderKind, PhotoShot } from "../types";

type WarehouseView = "library" | "create" | "orders" | "photo" | "checklist";
type OrderSort = "latest" | "highest";
type DraftPhoto = Pick<PhotoShot, "title" | "imageUrl" | "localPreviewUrl" | "itemIds" | "imageAssetId">;
type ChecklistFilter = ChecklistStatus;

const ITEM_PAGE_SIZE = 60;
const ORDER_PAGE_SIZE = 50;
const PHOTO_PAGE_SIZE = 20;
const CHECKLIST_PAGE_SIZE = 8;

const statusLabels: Record<ItemStatus, string> = {
  owned: "Owned",
  in_transit: "In transit",
  sold: "Sold",
  traded: "Traded",
  wanted: "Wanted"
};

const workspaceViews: Array<{ id: WarehouseView; icon: string; title: string }> = [
  { id: "library", icon: "L", title: "Library" },
  { id: "create", icon: "N", title: "New Item" },
  { id: "orders", icon: "O", title: "Orders" },
  { id: "photo", icon: "P", title: "Photo" },
  { id: "checklist", icon: "C", title: "Checklist" }
];

const emptyDraft: DraftItem = {
  name: "",
  categoryId: "cat-card",
  status: "owned",
  description: "",
  imageUrl: "",
  localPreviewUrl: "",
  storageLocation: "",
  tagIds: ["tag-football"],
  customValues: {},
  price: undefined,
  purchaseDate: "",
  purchaseAmount: undefined
};

const emptyOrderDraft: DraftPurchase = {
  kind: "buy",
  categoryId: "cat-card",
  merchant: "",
  platform: "CardHobby",
  paidAt: "",
  title: "",
  orderNo: "",
  itemAmount: 0,
  shippingAmount: 0,
  feeAmount: 0,
  currency: "CNY",
  sourceLink: "",
  notes: ""
};

const emptyPhotoDraft: DraftPhoto = {
  title: "",
  imageUrl: "",
  localPreviewUrl: "",
  itemIds: []
};

function displayImageUrl(entry: { imageUrl?: string; localPreviewUrl?: string }) {
  return String(entry.localPreviewUrl || entry.imageUrl || "");
}

const emptyChecklistDraft = {
  seriesName: "",
  rawEntries: ""
};

function buildItemName(categoryName: string, values: DraftItem["customValues"]) {
  const player = String(values["field-card-player"] ?? "").trim();
  const series = String(values["field-card-series"] ?? "").trim();
  const special = String(values["field-card-special"] ?? "").trim();
  const number = String(values["field-card-number"] ?? "").trim();
  const parts = [player, series, number, special].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : `${categoryName} Item`;
}

function buildUniqueItemName(baseName: string, existingItems: CollectionItem[], excludeItemId?: string) {
  const usedNames = new Set(
    existingItems
      .filter((item) => item.id !== excludeItemId)
      .map((item) => item.name.trim())
      .filter(Boolean)
  );
  if (!usedNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (usedNames.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

function itemListMeta(item: CollectionItem) {
  if (item.storageLocation?.trim()) {
    return item.storageLocation.trim();
  }
  if (typeof item.price === "number" && Number.isFinite(item.price)) {
    return `¥${item.price}`;
  }
  return item.id.slice(-6);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some((entry) => entry.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((entry) => entry.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeCsvHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^\d.-]/g, "").trim();
  const amount = Number(cleaned || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function withCardHobbyMerchantPrefix(value: string) {
  const merchant = value.trim();
  if (!merchant) {
    return "卡淘/未知卖家";
  }
  return merchant.startsWith("卡淘/") ? merchant : `卡淘/${merchant}`;
}

function cleanCardHobbyTitle(value: string) {
  return value
    .replace(/\s*商品编号[:：]\s*\d+.*$/u, "")
    .trim();
}

export function WarehouseScreen() {
  const {
    categories,
    fields,
    tags,
    items,
    purchases,
    photoShots,
    checklists,
    addItem,
    updateItem,
    deleteItem,
    addTag,
    addPurchase,
    addPhotoShot,
    linkPurchaseToItem,
    updatePurchase,
    deletePurchase,
    deleteTag,
    updatePhotoShot,
    deletePhotoShot,
    addChecklist,
    updateChecklist,
    deleteChecklist,
    setChecklistEntryItems,
    stageLocalImage
  } = useCollection();
  const [view, setView] = useState<WarehouseView>("library");
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [selectedCategoryId, setSelectedCategoryId] = useState("cat-card");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");
  const [activeTagFilter, setActiveTagFilter] = useState("all");
  const [itemPage, setItemPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [photoPage, setPhotoPage] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CollectionItem>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showOrderBind, setShowOrderBind] = useState(false);
  const [orderDraft, setOrderDraft] = useState<DraftPurchase>(emptyOrderDraft);
  const [orderSort, setOrderSort] = useState<OrderSort>("latest");
  const [showOrderSearch, setShowOrderSearch] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [showCreatePhotoModal, setShowCreatePhotoModal] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<DraftPhoto>(emptyPhotoDraft);
  const [showPhotoLinkPicker, setShowPhotoLinkPicker] = useState(false);
  const [selectedLinkedItemId, setSelectedLinkedItemId] = useState<string | null>(null);
  const [photoLinkQuery, setPhotoLinkQuery] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>("in_progress");
  const [checklistPage, setChecklistPage] = useState(1);
  const [showCreateChecklistModal, setShowCreateChecklistModal] = useState(false);
  const [checklistDraft, setChecklistDraft] = useState(emptyChecklistDraft);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [editingChecklist, setEditingChecklist] = useState<{ seriesName: string; rawEntries: string; status: ChecklistStatus } | null>(null);
  const [checklistPicker, setChecklistPicker] = useState<{ checklistId: string; entryId: string } | null>(null);
  const [checklistItemQuery, setChecklistItemQuery] = useState("");
  const [checklistCategoryFilter, setChecklistCategoryFilter] = useState("all");
  const addImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const currentCategoryId = draft.categoryId || selectedCategoryId;
  const currentCategory = categories.find((category) => category.id === currentCategoryId) ?? categories[0];
  const visibleFields = fields
    .filter((field) => field.categoryId === currentCategoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const visibleStandardFields = visibleFields.filter((field) => field.type !== "boolean");
  const visibleBooleanFields = visibleFields.filter((field) => field.type === "boolean");

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const categoryMatch = activeCategoryFilter === "all" || item.categoryId === activeCategoryFilter;
        const tagMatch = activeTagFilter === "all" || item.tagIds.includes(activeTagFilter);
        return categoryMatch && tagMatch;
      }),
    [activeCategoryFilter, activeTagFilter, items]
  );

  const sortedOrders = useMemo(() => {
    const next = [...purchases];
    if (orderSort === "highest") {
      return next.sort((left, right) => right.totalAmount - left.totalAmount);
    }
    return next.sort((left, right) => new Date(right.paidAt || 0).getTime() - new Date(left.paidAt || 0).getTime());
  }, [orderSort, purchases]);

  const pagedItems = filteredItems.slice((itemPage - 1) * ITEM_PAGE_SIZE, itemPage * ITEM_PAGE_SIZE);
  const itemPageCount = Math.max(1, Math.ceil(filteredItems.length / ITEM_PAGE_SIZE));
  const orderPageCount = Math.max(1, Math.ceil(sortedOrders.length / ORDER_PAGE_SIZE));
  const photoPageCount = Math.max(1, Math.ceil(photoShots.length / PHOTO_PAGE_SIZE));
  const pagedOrders = sortedOrders.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE);
  const pagedPhotos = photoShots.slice((photoPage - 1) * PHOTO_PAGE_SIZE, photoPage * PHOTO_PAGE_SIZE);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedItemFields = fields
    .filter((field) => field.categoryId === selectedItem?.categoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const selectedItemStandardFields = selectedItemFields.filter((field) => field.type !== "boolean");
  const selectedItemBooleanFields = selectedItemFields.filter((field) => field.type === "boolean");
  const selectedOrder = purchases.find((purchase) => purchase.id === selectedOrderId) ?? null;
  const selectedOrderItems = items.filter((item) => item.purchaseId === selectedOrder?.id);
  const bindableItems = items.filter((item) => item.purchaseId !== selectedOrder?.id);
  const selectedPhoto = photoShots.find((photo) => photo.id === selectedPhotoId) ?? null;
  const linkedPhotoItems = items.filter((item) => selectedPhoto?.itemIds.includes(item.id));
  const selectedLinkedItem = linkedPhotoItems.find((item) => item.id === selectedLinkedItemId) ?? linkedPhotoItems[0] ?? null;
  const photoLinkResults = items.filter((item) => {
    const query = photoLinkQuery.trim().toLowerCase();
    if (!query) return true;
    const tagNames = item.tagIds
      .map((tagId) => tags.find((tag) => tag.id === tagId)?.name ?? "")
      .join(" ")
      .toLowerCase();
    return item.name.toLowerCase().includes(query) || tagNames.includes(query);
  });

  const filteredChecklists = useMemo(
    () => checklists.filter((checklist) => checklist.status === checklistFilter),
    [checklistFilter, checklists]
  );
  const checklistPageCount = Math.max(1, Math.ceil(filteredChecklists.length / CHECKLIST_PAGE_SIZE));
  const pagedChecklists = filteredChecklists.slice((checklistPage - 1) * CHECKLIST_PAGE_SIZE, checklistPage * CHECKLIST_PAGE_SIZE);
  const selectedChecklist = checklists.find((checklist) => checklist.id === selectedChecklistId) ?? null;
  const selectedChecklistEntry = selectedChecklist?.entries.find((entry) => entry.id === checklistPicker?.entryId) ?? null;
  const checklistPickerResults = items.filter((item) => {
    const categoryMatch = checklistCategoryFilter === "all" || item.categoryId === checklistCategoryFilter;
    const query = checklistItemQuery.trim().toLowerCase();
    const tagNames = item.tagIds
      .map((tagId) => tags.find((tag) => tag.id === tagId)?.name ?? "")
      .join(" ")
      .toLowerCase();
    return categoryMatch && (!query || item.name.toLowerCase().includes(query) || tagNames.includes(query));
  });

  const suggestionValues = (field: CustomField) => {
    const values = items
      .map((item) => item.customValues[field.id])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    return Array.from(new Set(values));
  };

  useEffect(() => {
    setItemPage(1);
  }, [activeCategoryFilter, activeTagFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderSort]);

  useEffect(() => {
    if (photoPage > photoPageCount) {
      setPhotoPage(photoPageCount);
    }
  }, [photoPage, photoPageCount]);

  useEffect(() => {
    if (orderPage > orderPageCount) {
      setOrderPage(orderPageCount);
    }
  }, [orderPage, orderPageCount]);

  useEffect(() => {
    if (!selectedItem) return;
    setEditDraft(selectedItem);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedPhoto) return;
    setPhotoDraft({
      title: selectedPhoto.title ?? "",
      imageUrl: selectedPhoto.imageUrl,
      localPreviewUrl: selectedPhoto.localPreviewUrl ?? "",
      imageAssetId: selectedPhoto.imageAssetId,
      itemIds: selectedPhoto.itemIds
    });
    setSelectedLinkedItemId(selectedPhoto.itemIds[0] ?? null);
  }, [selectedPhoto]);

  useEffect(() => {
    setChecklistPage(1);
  }, [checklistFilter]);

  useEffect(() => {
    if (checklistPage > checklistPageCount) {
      setChecklistPage(checklistPageCount);
    }
  }, [checklistPage, checklistPageCount]);

  const confirmDelete = (message: string, action: () => void) => {
    if (window.confirm(message)) {
      action();
    }
  };

  const closeItemModal = () => {
    setSelectedItemId(null);
    setEditDraft({});
    setShowTagManager(false);
    setNewTagName("");
  };

  const closeOrderModal = () => {
    setSelectedOrderId(null);
    setShowOrderBind(false);
    setOrderDraft(emptyOrderDraft);
  };

  const closePhotoModal = () => {
    setSelectedPhotoId(null);
    setPhotoDraft(emptyPhotoDraft);
    setShowPhotoLinkPicker(false);
    setSelectedLinkedItemId(null);
    setPhotoLinkQuery("");
  };

  const closeCreatePhotoModal = () => {
    setShowCreatePhotoModal(false);
    setPhotoDraft(emptyPhotoDraft);
    setPhotoLinkQuery("");
  };

  const closeChecklistModal = () => {
    setSelectedChecklistId(null);
    setEditingChecklist(null);
  };

  const closeChecklistPicker = () => {
    setChecklistPicker(null);
    setChecklistItemQuery("");
    setChecklistCategoryFilter("all");
  };

  const checklistProgress = (checklist: ChecklistList) => {
    const total = checklist.entries.length;
    const done = checklist.entries.filter((entry) => entry.itemIds.length > 0).length;
    return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const serializeChecklistEntries = (entries: ChecklistEntry[]) => entries.map((entry) => entry.text).join("\n");

  const buildChecklistEntries = (rawEntries: string, existingEntries: ChecklistEntry[] = []) => {
    const nextLines = rawEntries
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    return nextLines.map((text, index) => {
      const matched = existingEntries.find((entry) => entry.text === text && !nextLines.slice(0, index).includes(entry.text));
      return matched ?? { id: `draft-${index}-${text}`, text, itemIds: [] };
    });
  };

  const onAddImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const staged = await stageLocalImage("item", file);
    setDraft((current) => ({ ...current, imageUrl: staged.previewUrl, localPreviewUrl: staged.previewUrl, imageAssetId: staged.assetId }));
    event.target.value = "";
  };

  const onEditImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedItemId) return;
    const staged = await stageLocalImage("item", file);
    setEditDraft((current) => ({ ...current, imageUrl: staged.previewUrl, localPreviewUrl: staged.previewUrl, imageAssetId: staged.assetId }));
    event.target.value = "";
  };

  const onAddPhotoImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const staged = await stageLocalImage("photo", file);
    setPhotoDraft((current) => ({ ...current, imageUrl: staged.previewUrl, localPreviewUrl: staged.previewUrl, imageAssetId: staged.assetId }));
    event.target.value = "";
  };

  const onEditPhotoImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const staged = await stageLocalImage("photo", file);
    setPhotoDraft((current) => ({ ...current, imageUrl: staged.previewUrl, localPreviewUrl: staged.previewUrl, imageAssetId: staged.assetId }));
    event.target.value = "";
  };

  const importOrdersFromCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    const [headerRow, ...dataRows] = rows;
    if (!headerRow) return;

    const headers = headerRow.map((entry) => normalizeCsvHeader(entry));
    const getValue = (columns: string[], row: string[]) => {
      const index = headers.findIndex((entry) => columns.includes(entry));
      return index >= 0 ? row[index] ?? "" : "";
    };

    dataRows.forEach((row) => {
      const paidAt = getValue(["日期", "date", "paidat", "paid_date", "下单时间"], row);
      const orderNo = getValue(["订单号", "orderno", "order_no"], row);
      const merchant = withCardHobbyMerchantPrefix(getValue(["卖家", "merchant", "seller"], row));
      const title = cleanCardHobbyTitle(getValue(["商品名称", "title", "name", "订单标题"], row));
      const shippingAmount = parseMoney(getValue(["运费", "shippingamount", "shipping", "邮费"], row));
      const totalAmount = parseMoney(getValue(["总额", "totalamount", "amount", "商品总额"], row));
      const unitPrice = parseMoney(getValue(["单价", "unitprice", "price"], row));
      const itemAmount = Math.max(0, totalAmount - shippingAmount) || unitPrice;
      addPurchase({
        kind: "buy",
        categoryId: "cat-card",
        merchant,
        platform: "CardHobby",
        paidAt,
        title,
        orderNo,
        itemAmount,
        shippingAmount,
        feeAmount: 0,
        currency: "CNY",
        sourceLink: "",
        notes: ""
      });
    });

    event.target.value = "";
  };

  const submitItem = (event: FormEvent) => {
    event.preventDefault();
    const name = buildUniqueItemName(buildItemName(currentCategory?.name ?? "Item", draft.customValues), items);
    addItem({
      ...draft,
      categoryId: currentCategoryId,
      name
    });
    setDraft({ ...emptyDraft, categoryId: currentCategoryId, tagIds: currentCategoryId === "cat-card" ? ["tag-football"] : [] });
  };

  const submitEditItem = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItemId) return;
    updateItem(selectedItemId, {
      ...editDraft,
      name: buildUniqueItemName(
        buildItemName(
          categories.find((category) => category.id === (editDraft.categoryId ?? selectedItem?.categoryId))?.name ?? "Item",
          (editDraft.customValues as CollectionItem["customValues"]) ?? {}
        ),
        items,
        selectedItemId
      )
    });
    closeItemModal();
  };

  const createGlobalTag = () => {
    const nextName = newTagName.trim();
    if (!nextName) return;
    const id = addTag(nextName);
    setEditDraft((current) => {
      const currentTags = (current.tagIds as string[] | undefined) ?? selectedItem?.tagIds ?? [];
      return {
        ...current,
        tagIds: currentTags.includes(id) ? currentTags : [...currentTags, id]
      };
    });
    setNewTagName("");
  };

  const openOrderDetail = (orderId: string) => {
    const purchase = purchases.find((entry) => entry.id === orderId);
    if (!purchase) return;
    setSelectedOrderId(orderId);
    setOrderDraft({
      kind: purchase.kind,
      categoryId: purchase.categoryId,
      merchant: purchase.merchant,
      platform: purchase.platform,
      paidAt: purchase.paidAt,
      title: purchase.title,
      orderNo: purchase.orderNo ?? "",
      itemAmount: purchase.itemAmount,
      shippingAmount: purchase.shippingAmount,
      feeAmount: purchase.feeAmount,
      currency: purchase.currency,
      sourceLink: purchase.sourceLink ?? "",
      notes: purchase.notes ?? ""
    });
    setShowOrderBind(false);
  };

  const submitOrder = (event: FormEvent) => {
    event.preventDefault();
    if (selectedOrderId === "new") {
      addPurchase(orderDraft);
    } else if (selectedOrderId) {
      updatePurchase(selectedOrderId, orderDraft);
    }
    closeOrderModal();
  };

  const openPhotoDetail = (photoId: string) => {
    setSelectedPhotoId(photoId);
    setShowPhotoLinkPicker(false);
    setPhotoLinkQuery("");
  };

  const submitPhoto = (event: FormEvent) => {
    event.preventDefault();
    if (!photoDraft.imageUrl.trim()) return;
    const nextId = addPhotoShot({
      imageUrl: photoDraft.imageUrl,
      localPreviewUrl: photoDraft.localPreviewUrl,
      imageAssetId: photoDraft.imageAssetId,
      title: (photoDraft.title ?? "").trim() || `Photo ${photoShots.length + 1}`,
      itemIds: photoDraft.itemIds
    });
    closeCreatePhotoModal();
    openPhotoDetail(nextId);
  };

  const submitPhotoUpdate = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPhoto) return;
    updatePhotoShot(selectedPhoto.id, {
      ...photoDraft,
      title: (photoDraft.title ?? "").trim() || selectedPhoto.title || "Photo"
    });
    closePhotoModal();
  };

  const submitChecklist = (event: FormEvent) => {
    event.preventDefault();
    const seriesName = checklistDraft.seriesName.trim();
    const entries = checklistDraft.rawEntries
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!seriesName || entries.length === 0) return;
    addChecklist(seriesName, entries);
    setChecklistDraft(emptyChecklistDraft);
    setShowCreateChecklistModal(false);
  };

  const openChecklistEditor = (checklist: ChecklistList) => {
    setSelectedChecklistId(checklist.id);
    setEditingChecklist({
      seriesName: checklist.seriesName,
      rawEntries: serializeChecklistEntries(checklist.entries),
      status: checklist.status
    });
  };

  const submitChecklistUpdate = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedChecklist || !editingChecklist) return;
    updateChecklist(selectedChecklist.id, {
      seriesName: editingChecklist.seriesName.trim() || selectedChecklist.seriesName,
      status: editingChecklist.status,
      entries: buildChecklistEntries(editingChecklist.rawEntries, selectedChecklist.entries)
    });
    closeChecklistModal();
  };

  const toggleChecklistItemLink = (itemId: string) => {
    if (!checklistPicker || !selectedChecklistEntry) return;
    const nextItemIds = selectedChecklistEntry.itemIds.includes(itemId)
      ? selectedChecklistEntry.itemIds.filter((entryId) => entryId !== itemId)
      : [...selectedChecklistEntry.itemIds, itemId];
    setChecklistEntryItems(checklistPicker.checklistId, checklistPicker.entryId, nextItemIds);
  };

  const renderFieldInput = (
    field: CustomField,
    values: DraftItem["customValues"] | CollectionItem["customValues"],
    setValues: (next: CollectionItem["customValues"]) => void
  ) => {
    const value = values[field.id];
    const datalistId = `${field.id}-list`;
    const suggestions = field.autocomplete ? suggestionValues(field) : [];
    const isSerialNumber = field.id === "field-card-serial-number";
    const serialEnabled = Boolean(values["field-card-serial-enabled"]);
    if (isSerialNumber && !serialEnabled) {
      return null;
    }

    if (field.type === "boolean") {
      return (
        <label className="checkbox-field" key={field.id}>
          <input checked={Boolean(value)} onChange={(event) => setValues({ ...values, [field.id]: event.target.checked })} type="checkbox" />
          <span>{field.name}</span>
        </label>
      );
    }

    if (field.type === "single") {
      return (
        <div className="field" key={field.id}>
          <label>{field.name}</label>
          <select value={String(value ?? "")} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}>
            <option value="">Select</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className="field" key={field.id}>
        <label>{field.name}</label>
        <input
          list={suggestions.length > 0 ? datalistId : undefined}
          onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
          placeholder={field.name}
          value={String(value ?? "")}
        />
        {suggestions.length > 0 ? (
          <datalist id={datalistId}>
            {suggestions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        ) : null}
      </div>
    );
  };

  return (
    <Screen title="Database" subtitle="Library, orders, photos, and checklist live together here.">
      <div className="workspace-nav compact">
        {workspaceViews.map((entry) => (
          <button className={`workspace-nav-card ${view === entry.id ? "active" : ""}`.trim()} key={entry.id} onClick={() => setView(entry.id)} type="button">
            <span className="workspace-nav-icon">{entry.icon}</span>
            <span className="workspace-nav-copy">
              <strong>{entry.title}</strong>
            </span>
          </button>
        ))}
      </div>

      {view === "library" ? (
        <Section title="Library">
          <Card className="library-filter-card">
            <Stack>
              <div className="filter-group">
                <div className={`filter-chip-row ${showAllCategories ? "expanded" : ""}`.trim()}>
                  <Chip label="All categories" active={activeCategoryFilter === "all"} onClick={() => setActiveCategoryFilter("all")} />
                  {categories.map((category) => (
                    <Chip key={category.id} label={category.name} active={activeCategoryFilter === category.id} onClick={() => setActiveCategoryFilter(category.id)} />
                  ))}
                </div>
                <button className="filter-toggle" onClick={() => setShowAllCategories((value) => !value)} type="button">
                  {showAllCategories ? "Less" : "More"}
                </button>
              </div>
              <div className="filter-group">
                <div className={`filter-chip-row ${showAllTags ? "expanded" : ""}`.trim()}>
                  <Chip label="All tags" active={activeTagFilter === "all"} onClick={() => setActiveTagFilter("all")} />
                  {tags.map((tag) => (
                    <Chip key={tag.id} label={tag.name} active={activeTagFilter === tag.id} onClick={() => setActiveTagFilter(tag.id)} />
                  ))}
                </div>
                <button className="filter-toggle" onClick={() => setShowAllTags((value) => !value)} type="button">
                  {showAllTags ? "Less" : "More"}
                </button>
              </div>
            </Stack>
          </Card>

          {pagedItems.length > 0 ? (
            <div className="image-grid compact-grid">
              {pagedItems.map((item) => (
                <button className="image-tile small" key={item.id} onClick={() => setSelectedItemId(item.id)} type="button">
                  {displayImageUrl(item) ? <img alt={item.name} src={displayImageUrl(item)} /> : <div className="image-tile-placeholder">No image</div>}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No items yet" copy="Add your first item and it will appear here." />
          )}

          <Row between>
            <span className="muted">Up to 60 items per page · {itemPage} / {itemPageCount}</span>
            <div className="toolbar-row">
              <Button className="compact-button" label="Previous" onClick={() => setItemPage((value) => Math.max(1, value - 1))} tone="quiet" />
              <Button className="compact-button" label="Next" onClick={() => setItemPage((value) => Math.min(itemPageCount, value + 1))} tone="quiet" />
            </div>
          </Row>

          {selectedItem ? (
            <div className="modal-backdrop" onClick={closeItemModal}>
              <div className="modal-panel item-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-topbar">
                  <strong>{selectedItem.name}</strong>
                  <IconButton label="Close" onClick={closeItemModal} />
                </div>
                <form onSubmit={submitEditItem}>
                  <div className="detail-hero-layout">
                    <button className="detail-image compact-photo clickable-image detail-photo-large" onClick={() => editImageInputRef.current?.click()} type="button">
                      {String(editDraft.imageUrl ?? selectedItem.imageUrl ?? "").trim() ? (
                        <img alt={selectedItem.name} src={displayImageUrl({ imageUrl: String(editDraft.imageUrl ?? selectedItem.imageUrl ?? ""), localPreviewUrl: String(editDraft.localPreviewUrl ?? selectedItem.localPreviewUrl ?? "") })} />
                      ) : (
                        <div className="image-tile-placeholder">No image</div>
                      )}
                    </button>
                    <div className="detail-tags-panel">
                      <div className="field">
                        <label>Tags</label>
                        <div className="tag-row">
                          {tags.map((tag) => {
                            const active = (editDraft.tagIds ?? selectedItem.tagIds ?? []).includes(tag.id);
                            return (
                              <Chip
                                key={tag.id}
                                label={tag.name}
                                active={active}
                                onClick={() =>
                                  setEditDraft((current) => {
                                    const currentTags = (current.tagIds as string[] | undefined) ?? selectedItem.tagIds ?? [];
                                    return {
                                      ...current,
                                      tagIds: active ? currentTags.filter((tagId) => tagId !== tag.id) : [...currentTags, tag.id]
                                    };
                                  })
                                }
                              />
                            );
                          })}
                          <button className="tag-plus-button" onClick={() => setShowTagManager(true)} title="Edit global tags" type="button">
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <input accept="image/*" capture="environment" hidden onChange={onEditImage} ref={editImageInputRef} type="file" />
                  <div className="detail-fields-grid">
                    <div className="field">
                      <label>Status</label>
                      <select
                        value={String(editDraft.status ?? selectedItem.status)}
                        onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value as ItemStatus }))}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Field
                      label="Storage"
                      value={String(editDraft.storageLocation ?? "")}
                      onChange={(value) => setEditDraft((current) => ({ ...current, storageLocation: value }))}
                    />
                    <Field
                      label="Card value"
                      type="number"
                      value={String(editDraft.price ?? "")}
                      onChange={(value) => setEditDraft((current) => ({ ...current, price: value ? Number(value) : undefined }))}
                    />
                    <Field
                      label="Purchase date"
                      type="date"
                      value={String(editDraft.purchaseDate ?? "")}
                      onChange={(value) => setEditDraft((current) => ({ ...current, purchaseDate: value }))}
                    />
                    <Field
                      label="Purchase amount"
                      type="number"
                      value={String(editDraft.purchaseAmount ?? "")}
                      onChange={(value) => setEditDraft((current) => ({ ...current, purchaseAmount: value ? Number(value) : undefined }))}
                    />
                    {selectedItemStandardFields.map((field) =>
                      renderFieldInput(
                        field,
                        (editDraft.customValues as CollectionItem["customValues"]) ?? selectedItem.customValues,
                        (next) => setEditDraft((current) => ({ ...current, customValues: next }))
                      )
                    )}
                  </div>
                  {selectedItemBooleanFields.length > 0 ? (
                    <div className="boolean-field-row">
                      {selectedItemBooleanFields.map((field) =>
                        renderFieldInput(
                          field,
                          (editDraft.customValues as CollectionItem["customValues"]) ?? selectedItem.customValues,
                          (next) => setEditDraft((current) => ({ ...current, customValues: next }))
                        )
                      )}
                    </div>
                  ) : null}
                  <div className="modal-actions">
                    <Button label="Save changes" type="submit" />
                    <Button
                      label="Delete item"
                      tone="danger"
                      onClick={() =>
                        confirmDelete("Delete this item?", () => {
                          deleteItem(selectedItem.id);
                          closeItemModal();
                        })
                      }
                    />
                  </div>
                </form>

                {showTagManager ? (
                  <div className="tag-manager-backdrop" onClick={() => setShowTagManager(false)}>
                    <div className="tag-manager-panel" onClick={(event) => event.stopPropagation()}>
                      <div className="modal-topbar compact-topbar">
                        <strong>Global tags</strong>
                        <IconButton label="Close" onClick={() => setShowTagManager(false)} />
                      </div>
                      <div className="tag-manager-grid">
                        {tags.map((tag) => (
                          <div className="tag-manager-chip" key={tag.id}>
                            <span>{tag.name}</span>
                            <button
                              className="tag-chip-close"
                              onClick={() => deleteTag(tag.id)}
                              title={`Delete ${tag.name}`}
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="tag-create-row">
                        <input
                          className="inline-input"
                          onChange={(event) => setNewTagName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              createGlobalTag();
                            }
                          }}
                          placeholder="New tag"
                          value={newTagName}
                        />
                        <Button className="compact-button" label="Add tag" onClick={createGlobalTag} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {view === "create" ? (
        <Section title="New Item">
          <Card>
            <form onSubmit={submitItem}>
              <Stack>
                <Row wrap>
                  {categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      active={currentCategoryId === category.id}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setDraft((current) => ({
                          ...current,
                          categoryId: category.id,
                          customValues: {},
                          tagIds: category.id === "cat-card" ? ["tag-football"] : []
                        }));
                      }}
                    />
                  ))}
                </Row>

                <div className="integrated-form">
                  <button className="detail-image uploader-tile compact-photo clickable-image" onClick={() => addImageInputRef.current?.click()} type="button">
                    {displayImageUrl(draft) ? <img alt="Item preview" src={displayImageUrl(draft)} /> : <div className="image-tile-placeholder">Add image</div>}
                    <input accept="image/*" capture="environment" hidden onChange={onAddImage} ref={addImageInputRef} type="file" />
                  </button>

                  <div className="form-grid">
                    <Field label="Storage" value={draft.storageLocation ?? ""} onChange={(value) => setDraft((current) => ({ ...current, storageLocation: value }))} placeholder="Box A / Row 1" />
                    <Field
                      label="Card value"
                      type="number"
                      value={String(draft.price ?? "")}
                      onChange={(value) => setDraft((current) => ({ ...current, price: value ? Number(value) : undefined }))}
                      placeholder="132"
                    />
                    {visibleStandardFields.map((field) =>
                      renderFieldInput(field, draft.customValues, (next) => setDraft((current) => ({ ...current, customValues: next })))
                    )}
                  </div>
                  {visibleBooleanFields.length > 0 ? (
                    <div className="boolean-field-row">
                      {visibleBooleanFields.map((field) =>
                        renderFieldInput(field, draft.customValues, (next) => setDraft((current) => ({ ...current, customValues: next })))
                      )}
                    </div>
                  ) : null}
                </div>

                <Row>
                  <Button label="Add item" type="submit" />
                </Row>
              </Stack>
            </form>
          </Card>
        </Section>
      ) : null}

      {view === "orders" ? (
        <Section title="Orders">
          <div className="orders-toolbar">
            <div className="toolbar-row">
              <Button
                label="New order"
                onClick={() => {
                  setSelectedOrderId("new");
                  setOrderDraft({ ...emptyOrderDraft, categoryId: categories[0]?.id ?? "cat-card" });
                  setShowOrderBind(false);
                }}
              />
              <Button className="compact-button" label="Import CSV" onClick={() => csvInputRef.current?.click()} tone="quiet" />
              <input accept=".csv,text/csv" hidden onChange={importOrdersFromCsv} ref={csvInputRef} type="file" />
            </div>
            <div className="toolbar-row">
              <button
                className={`tool-orb ${orderSort === "highest" ? "active" : ""}`.trim()}
                onClick={() => setOrderSort((current) => (current === "latest" ? "highest" : "latest"))}
                title={orderSort === "latest" ? "Sort: newest first" : "Sort: highest value first"}
                type="button"
              >
                ↕
              </button>
              <button className={`tool-orb ${showOrderSearch ? "active" : ""}`.trim()} onClick={() => setShowOrderSearch((value) => !value)} title="Search and filter" type="button">
                ⌕
              </button>
            </div>
          </div>

          {showOrderSearch ? (
            <Card className="search-placeholder-card">
              <span className="muted">Search and filter tools will live here next.</span>
            </Card>
          ) : null}

          <Card>
            <Stack>
              {pagedOrders.map((purchase) => (
                <button className={`list-row ${selectedOrder?.id === purchase.id ? "active" : ""}`.trim()} key={purchase.id} onClick={() => openOrderDetail(purchase.id)} type="button">
                  <div className="stack">
                    <span>{purchase.title || purchase.orderNo || "Untitled order"}</span>
                    <span className="muted">
                      {purchase.kind.toUpperCase()} · {categories.find((category) => category.id === purchase.categoryId)?.name ?? "Category"}
                    </span>
                  </div>
                  <span className="muted">¥{purchase.totalAmount}</span>
                </button>
              ))}
              <Row between>
                <span className="muted">Up to 50 orders per page · {orderPage} / {orderPageCount}</span>
                <div className="toolbar-row">
                  <Button className="compact-button" label="Previous" onClick={() => setOrderPage((value) => Math.max(1, value - 1))} tone="quiet" />
                  <Button className="compact-button" label="Next" onClick={() => setOrderPage((value) => Math.min(orderPageCount, value + 1))} tone="quiet" />
                </div>
              </Row>
            </Stack>
          </Card>

          {selectedOrderId ? (
            <div className="modal-backdrop" onClick={closeOrderModal}>
              <div className="modal-panel order-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-topbar">
                  <strong>{selectedOrderId === "new" ? "New order" : "Order details"}</strong>
                  <IconButton label="Close" onClick={closeOrderModal} />
                </div>

                <form onSubmit={submitOrder}>
                  <div className="form-grid">
                    <div className="field">
                      <label>Type</label>
                      <select value={orderDraft.kind} onChange={(event) => setOrderDraft((current) => ({ ...current, kind: event.target.value as OrderKind }))}>
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Category</label>
                      <select value={orderDraft.categoryId} onChange={(event) => setOrderDraft((current) => ({ ...current, categoryId: event.target.value }))}>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Field label="Order title" value={orderDraft.title} onChange={(value) => setOrderDraft((current) => ({ ...current, title: value }))} />
                    <Field label="Merchant" value={orderDraft.merchant} onChange={(value) => setOrderDraft((current) => ({ ...current, merchant: value }))} />
                    <Field label="Platform" value={orderDraft.platform} onChange={(value) => setOrderDraft((current) => ({ ...current, platform: value }))} />
                    <Field label="Paid date" type="date" value={orderDraft.paidAt} onChange={(value) => setOrderDraft((current) => ({ ...current, paidAt: value }))} />
                    <Field label="Order no." value={orderDraft.orderNo ?? ""} onChange={(value) => setOrderDraft((current) => ({ ...current, orderNo: value }))} />
                    <Field
                      label={orderDraft.kind === "sell" ? "Sale amount" : "Item amount"}
                      type="number"
                      value={String(orderDraft.itemAmount)}
                      onChange={(value) => setOrderDraft((current) => ({ ...current, itemAmount: Number(value || 0) }))}
                    />
                    <Field label="Shipping" type="number" value={String(orderDraft.shippingAmount)} onChange={(value) => setOrderDraft((current) => ({ ...current, shippingAmount: Number(value || 0) }))} />
                    {orderDraft.kind === "sell" ? (
                      <Field
                        label="Fee"
                        type="number"
                        value={String(orderDraft.feeAmount)}
                        onChange={(value) => setOrderDraft((current) => ({ ...current, feeAmount: Number(value || 0) }))}
                      />
                    ) : null}
                    <Field label="Currency" value={orderDraft.currency} onChange={(value) => setOrderDraft((current) => ({ ...current, currency: value }))} />
                    <Field label="Source link" value={orderDraft.sourceLink ?? ""} onChange={(value) => setOrderDraft((current) => ({ ...current, sourceLink: value }))} />
                    <Field label="Notes" textarea value={orderDraft.notes ?? ""} onChange={(value) => setOrderDraft((current) => ({ ...current, notes: value }))} />
                  </div>

                  {selectedOrderId !== "new" ? (
                    <div className="order-bind-panel">
                      <div className="row between">
                        <strong>Linked items</strong>
                        <Button label={showOrderBind ? "Hide picker" : "Link items"} onClick={() => setShowOrderBind((value) => !value)} tone="quiet" />
                      </div>
                      <div className="compact-list">
                        {selectedOrderItems.length > 0 ? (
                          selectedOrderItems.map((item) => (
                            <div className="list-row static" key={item.id}>
                              <span>{item.name}</span>
                              <span className="muted">{item.purchaseAmount ? `¥${item.purchaseAmount}` : "Auto synced"}</span>
                            </div>
                          ))
                        ) : (
                          <div className="list-row static">
                            <span className="muted">No linked items yet</span>
                          </div>
                        )}
                      </div>

                      {showOrderBind ? (
                        <div className="compact-list">
                          {bindableItems.length > 0 ? (
                            bindableItems.map((item) => (
                              <button className="list-row" key={item.id} onClick={() => selectedOrder && linkPurchaseToItem(selectedOrder.id, item.id)} type="button">
                                <span>{item.name}</span>
                                <span className="muted">{item.purchaseId ? "Re-link" : "Bind"}</span>
                              </button>
                            ))
                          ) : (
                            <div className="list-row static">
                              <span className="muted">Every item is already linked</span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="modal-actions">
                    <Button label={selectedOrderId === "new" ? "Create order" : "Save update"} type="submit" />
                    {selectedOrder ? (
                      <Button
                        label="Delete order"
                        tone="danger"
                        onClick={() =>
                          confirmDelete("Delete this order?", () => {
                            deletePurchase(selectedOrder.id);
                            closeOrderModal();
                          })
                        }
                      />
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {view === "checklist" ? (
        <Section title="Checklist">
          <div className="checklist-header-row">
            <div className="toolbar-row">
              <Chip label="In progress" active={checklistFilter === "in_progress"} onClick={() => setChecklistFilter("in_progress")} />
              <Chip label="Finished" active={checklistFilter === "finished"} onClick={() => setChecklistFilter("finished")} />
            </div>
            <button
              className="tool-orb active"
              onClick={() => {
                setChecklistDraft(emptyChecklistDraft);
                setShowCreateChecklistModal(true);
              }}
              title="Create new checklist"
              type="button"
            >
              +
            </button>
          </div>

          {pagedChecklists.length > 0 ? (
            <div className="checklist-grid">
              {pagedChecklists.map((checklist) => {
                const progress = checklistProgress(checklist);
                return (
                  <Card className="checklist-card" key={checklist.id}>
                    <div className="row between checklist-card-top">
                      <div className="stack compact-gap">
                        <strong>{checklist.seriesName}</strong>
                        <span className="muted">
                          {progress.done} / {progress.total} · {progress.percent}%
                        </span>
                      </div>
                      <button className="icon-button" onClick={() => openChecklistEditor(checklist)} title="Edit checklist" type="button">
                        ···
                      </button>
                    </div>
                    <div className="checklist-lines">
                      {checklist.entries.map((entry) => {
                        const linkedItems = items.filter((item) => entry.itemIds.includes(item.id));
                        return (
                          <div className="checklist-line" key={entry.id}>
                            <button
                              className={`check-circle ${entry.itemIds.length > 0 ? "filled" : ""}`.trim()}
                              onClick={() => {
                                setSelectedChecklistId(checklist.id);
                                setChecklistPicker({ checklistId: checklist.id, entryId: entry.id });
                              }}
                              type="button"
                            >
                              {entry.itemIds.length > 0 ? "✓" : ""}
                            </button>
                            <div className="stack compact-gap checklist-line-copy">
                              <span>{entry.text}</span>
                              {linkedItems.length > 0 ? (
                                <div className="linked-mini-row">
                                  {linkedItems.map((item) => (
                                    <div className="linked-mini-card" key={item.id}>
                                      {displayImageUrl(item) ? <img alt={item.name} src={displayImageUrl(item)} /> : <span>{item.name.slice(0, 1)}</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState title={checklistFilter === "in_progress" ? "No active checklist" : "No finished checklist"} copy="Create a series list and start linking cards to each target." />
          )}

          <Row between>
            <span className="muted">Up to 8 lists per page · {checklistPage} / {checklistPageCount}</span>
            <div className="toolbar-row">
              <Button className="compact-button" label="Previous" onClick={() => setChecklistPage((value) => Math.max(1, value - 1))} tone="quiet" />
              <Button className="compact-button" label="Next" onClick={() => setChecklistPage((value) => Math.min(checklistPageCount, value + 1))} tone="quiet" />
            </div>
          </Row>

          {showCreateChecklistModal ? (
            <div className="modal-backdrop" onClick={() => setShowCreateChecklistModal(false)}>
              <div className="modal-panel compact-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-topbar">
                  <strong>New checklist</strong>
                  <IconButton label="Close" onClick={() => setShowCreateChecklistModal(false)} />
                </div>
                <form onSubmit={submitChecklist}>
                  <div className="stack">
                    <Field
                      label="Series name"
                      value={checklistDraft.seriesName}
                      onChange={(value) => setChecklistDraft((current) => ({ ...current, seriesName: value }))}
                      placeholder="Topps Chrome 2025"
                    />
                    <Field
                      label="Wanted items"
                      textarea
                      value={checklistDraft.rawEntries}
                      onChange={(value) => setChecklistDraft((current) => ({ ...current, rawEntries: value }))}
                      placeholder={"One target per line\nOrange /25\nAuto\nBase"}
                    />
                  </div>
                  <div className="modal-actions">
                    <Button label="Create list" type="submit" />
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {selectedChecklist && editingChecklist ? (
            <div className="modal-backdrop" onClick={closeChecklistModal}>
              <div className="modal-panel compact-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-topbar">
                  <strong>Edit checklist</strong>
                  <IconButton label="Close" onClick={closeChecklistModal} />
                </div>
                <form onSubmit={submitChecklistUpdate}>
                  <div className="stack">
                    <Field
                      label="Series name"
                      value={editingChecklist.seriesName}
                      onChange={(value) => setEditingChecklist((current) => (current ? { ...current, seriesName: value } : current))}
                    />
                    <div className="field">
                      <label>Status</label>
                      <select
                        value={editingChecklist.status}
                        onChange={(event) =>
                          setEditingChecklist((current) =>
                            current ? { ...current, status: event.target.value as ChecklistStatus } : current
                          )
                        }
                      >
                        <option value="in_progress">In progress</option>
                        <option value="finished">Finished</option>
                      </select>
                    </div>
                    <Field
                      label="List content"
                      textarea
                      value={editingChecklist.rawEntries}
                      onChange={(value) => setEditingChecklist((current) => (current ? { ...current, rawEntries: value } : current))}
                    />
                  </div>
                  <div className="modal-actions">
                    <Button label="Save changes" type="submit" />
                    <Button
                      label="Delete list"
                      tone="danger"
                      onClick={() =>
                        confirmDelete("Delete this checklist?", () => {
                          deleteChecklist(selectedChecklist.id);
                          closeChecklistModal();
                        })
                      }
                    />
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {checklistPicker && selectedChecklistEntry ? (
            <div className="modal-backdrop" onClick={closeChecklistPicker}>
              <div className="modal-panel compact-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-topbar">
                  <strong>{selectedChecklistEntry.text}</strong>
                  <IconButton label="Close" onClick={closeChecklistPicker} />
                </div>
                <div className="stack">
                  <div className="filter-group">
                    <div className="filter-chip-row expanded">
                      <Chip label="All categories" active={checklistCategoryFilter === "all"} onClick={() => setChecklistCategoryFilter("all")} />
                      {categories.map((category) => (
                        <Chip
                          key={category.id}
                          label={category.name}
                          active={checklistCategoryFilter === category.id}
                          onClick={() => setChecklistCategoryFilter(category.id)}
                        />
                      ))}
                    </div>
                  </div>
                  <Field
                    label="Search"
                    value={checklistItemQuery}
                    onChange={setChecklistItemQuery}
                    placeholder="Filter by name or tag"
                  />
                  <div className="picker-grid checklist-picker-grid">
                    {checklistPickerResults.map((item) => {
                      const active = selectedChecklistEntry.itemIds.includes(item.id);
                      return (
                        <button
                          className={`picker-card ${active ? "active" : ""}`.trim()}
                          key={item.id}
                          onClick={() => toggleChecklistItemLink(item.id)}
                          type="button"
                        >
                          <div className="picker-card-shell">
                            <div className="picker-thumb">
                              {displayImageUrl(item) ? <img alt={item.name} src={displayImageUrl(item)} /> : <div className="image-tile-placeholder">No image</div>}
                            </div>
                          </div>
                          <strong>{item.name}</strong>
                        </button>
                      );
                    })}
                  </div>
                  <div className="modal-actions">
                    <Button label="Done" onClick={closeChecklistPicker} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {view === "photo" ? (
        <section className="section">
          <div className="gallery-heading-row">
            <h3>Photo</h3>
            <Button
              className="compact-button"
              label="Add photo"
              onClick={() => {
                setPhotoDraft(emptyPhotoDraft);
                setPhotoLinkQuery("");
                setShowCreatePhotoModal(true);
              }}
            />
          </div>

          {photoShots.length > 0 ? (
            <div className="image-grid photo-grid">
              {pagedPhotos.map((photo) => (
                <button className="image-tile photo-tile" key={photo.id} onClick={() => openPhotoDetail(photo.id)} type="button">
                  <img alt={photo.title ?? "Photo"} src={displayImageUrl(photo)} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No photos yet" copy="Add your first real-life shot here." />
          )}

          <Row between>
            <span className="muted">Up to 20 photos per page · {photoPage} / {photoPageCount}</span>
            <div className="toolbar-row">
              <Button className="compact-button" label="Previous" onClick={() => setPhotoPage((value) => Math.max(1, value - 1))} tone="quiet" />
              <Button className="compact-button" label="Next" onClick={() => setPhotoPage((value) => Math.min(photoPageCount, value + 1))} tone="quiet" />
            </div>
          </Row>

          {showCreatePhotoModal ? (
            <div className="modal-backdrop" onClick={closeCreatePhotoModal}>
              <div className="modal-panel item-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-topbar">
                  <strong>Add photo</strong>
                  <IconButton label="Close" onClick={closeCreatePhotoModal} />
                </div>
                <form onSubmit={submitPhoto}>
                  <div className="detail-hero-layout photo-detail-layout">
                    <button className="detail-image compact-photo clickable-image detail-photo-large" onClick={() => addPhotoInputRef.current?.click()} type="button">
                      {displayImageUrl(photoDraft) ? <img alt="Photo preview" src={displayImageUrl(photoDraft)} /> : <div className="image-tile-placeholder">Add photo</div>}
                    </button>
                    <div className="detail-tags-panel">
                      <Field label="Title" value={photoDraft.title ?? ""} onChange={(value) => setPhotoDraft((current) => ({ ...current, title: value }))} placeholder="Match day shot" />
                      <div className="field">
                        <label>Link cards</label>
                        <input
                          className="inline-input"
                          onChange={(event) => setPhotoLinkQuery(event.target.value)}
                          placeholder="Search by tag"
                          value={photoLinkQuery}
                        />
                        <div className="compact-list">
                          {photoLinkResults.map((item) => {
                            const active = photoDraft.itemIds.includes(item.id);
                            return (
                              <button
                                className={`list-row ${active ? "active" : ""}`.trim()}
                                key={item.id}
                                onClick={() =>
                                  setPhotoDraft((current) => ({
                                    ...current,
                                    itemIds: active ? current.itemIds.filter((itemId) => itemId !== item.id) : [...current.itemIds, item.id]
                                  }))
                                }
                                type="button"
                              >
                                <span>
                                  {item.name}
                                  <span className="muted list-row-meta">{itemListMeta(item)}</span>
                                </span>
                                <span className="muted">{active ? "Linked" : "Add"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <input accept="image/*" capture="environment" hidden onChange={onAddPhotoImage} ref={addPhotoInputRef} type="file" />
                  <div className="modal-actions">
                    <Button label="Save photo" type="submit" />
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {selectedPhoto ? (
            <div className="modal-backdrop" onClick={closePhotoModal}>
              <div className="modal-panel item-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-topbar">
                  <strong>{selectedPhoto.title || "Photo"}</strong>
                  <IconButton label="Close" onClick={closePhotoModal} />
                </div>
                <form onSubmit={submitPhotoUpdate}>
                  <div className="detail-hero-layout photo-detail-layout">
                    <button className="detail-image compact-photo clickable-image detail-photo-large" onClick={() => editPhotoInputRef.current?.click()} type="button">
                      <img alt={selectedPhoto.title ?? "Photo"} src={displayImageUrl({ imageUrl: photoDraft.imageUrl || selectedPhoto.imageUrl, localPreviewUrl: photoDraft.localPreviewUrl || selectedPhoto.localPreviewUrl })} />
                    </button>
                    <div className="detail-tags-panel">
                      <div className="field">
                        <label>Linked cards</label>
                        <div className="linked-thumb-row">
                          {linkedPhotoItems.map((item, index) => (
                            <button
                              className={`linked-thumb ${selectedLinkedItem?.id === item.id ? "active" : ""}`.trim()}
                              key={item.id}
                              onClick={() => setSelectedLinkedItemId(item.id)}
                              type="button"
                            >
                              <span className="linked-thumb-order">{index + 1}</span>
                              {displayImageUrl(item) ? <img alt={item.name} src={displayImageUrl(item)} /> : <span className="linked-thumb-fallback">{item.name.slice(0, 1)}</span>}
                            </button>
                          ))}
                          <button className="tag-plus-button" onClick={() => setShowPhotoLinkPicker((value) => !value)} title="Link cards" type="button">
                            +
                          </button>
                        </div>
                        {showPhotoLinkPicker ? (
                          <div className="stack">
                            <input
                              className="inline-input"
                              onChange={(event) => setPhotoLinkQuery(event.target.value)}
                              placeholder="Search by tag"
                              value={photoLinkQuery}
                            />
                            <div className="compact-list">
                              {photoLinkResults.map((item) => {
                              const active = photoDraft.itemIds.includes(item.id);
                              return (
                                <button
                                  className={`list-row ${active ? "active" : ""}`.trim()}
                                  key={item.id}
                                  onClick={() =>
                                    setPhotoDraft((current) => ({
                                      ...current,
                                      itemIds: active ? current.itemIds.filter((itemId) => itemId !== item.id) : [...current.itemIds, item.id]
                                    }))
                                  }
                                  type="button"
                                >
                                  <span>
                                    {item.name}
                                    <span className="muted list-row-meta">{itemListMeta(item)}</span>
                                  </span>
                                  <span className="muted">{active ? "Linked" : "Add"}</span>
                                </button>
                              );
                            })}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {selectedLinkedItem ? (
                        <div className="linked-item-card">
                          <div className="row">
                            <div className="thumb">
                              {displayImageUrl(selectedLinkedItem) ? <img alt={selectedLinkedItem.name} src={displayImageUrl(selectedLinkedItem)} /> : <div className="image-tile-placeholder">No image</div>}
                            </div>
                            <div className="stack">
                              <strong>{selectedLinkedItem.name}</strong>
                              <span className="muted">{categories.find((category) => category.id === selectedLinkedItem.categoryId)?.name ?? "Item"}</span>
                              <span className="muted">{statusLabels[selectedLinkedItem.status]}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="linked-item-card empty">
                          <span className="muted">No linked cards yet</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <input accept="image/*" capture="environment" hidden onChange={onEditPhotoImage} ref={editPhotoInputRef} type="file" />
                  <div className="detail-fields-grid">
                    <Field label="Title" value={photoDraft.title ?? ""} onChange={(value) => setPhotoDraft((current) => ({ ...current, title: value }))} />
                  </div>
                  <div className="modal-actions">
                    <Button label="Save changes" type="submit" />
                    <Button
                      label="Delete photo"
                      tone="danger"
                      onClick={() =>
                        confirmDelete("Delete this photo?", () => {
                          deletePhotoShot(selectedPhoto.id);
                          closePhotoModal();
                        })
                      }
                    />
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </Screen>
  );
}
