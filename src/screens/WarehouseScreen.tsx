import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { Button, Card, Chip, EmptyState, Field, Row, Screen, Section, Stack } from "../components/ui";
import { useCollection } from "../store/collectionStore";
import { CollectionItem, CustomField, DraftItem, DraftPurchase, ItemStatus } from "../types";

type WarehouseView = "library" | "create" | "orders";

const statusLabels: Record<ItemStatus, string> = {
  owned: "已拥有",
  in_transit: "在途",
  sold: "已售出",
  traded: "已交换",
  wanted: "想要"
};

const emptyDraft: DraftItem = {
  name: "",
  categoryId: "cat-card",
  status: "owned",
  description: "",
  imageUrl: "",
  storageLocation: "",
  tagIds: ["tag-football"],
  customValues: {},
  price: undefined,
  purchaseDate: "",
  purchaseAmount: undefined
};

const emptyOrderDraft: DraftPurchase = {
  merchant: "",
  platform: "CardHobby",
  paidAt: "",
  title: "",
  orderNo: "",
  itemAmount: 0,
  shippingAmount: 0,
  currency: "CNY",
  sourceLink: "",
  notes: ""
};

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function buildItemName(categoryName: string, values: DraftItem["customValues"]) {
  const player = String(values["field-card-player"] ?? "").trim();
  const series = String(values["field-card-series"] ?? "").trim();
  const special = String(values["field-card-special"] ?? "").trim();
  const parts = [player, series, special].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : `${categoryName}藏品`;
}

export function WarehouseScreen() {
  const {
    categories,
    fields,
    tags,
    items,
    purchases,
    addItem,
    updateItem,
    deleteItem,
    addPurchase,
    linkPurchaseToItem,
    updatePurchase,
    deletePurchase
  } = useCollection();
  const [view, setView] = useState<WarehouseView>("library");
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [selectedCategoryId, setSelectedCategoryId] = useState("cat-card");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");
  const [activeTagFilter, setActiveTagFilter] = useState("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CollectionItem>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showOrderBind, setShowOrderBind] = useState(false);
  const [orderDraft, setOrderDraft] = useState<DraftPurchase>(emptyOrderDraft);
  const [editingOrder, setEditingOrder] = useState(false);
  const addImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);

  const currentCategoryId = draft.categoryId || selectedCategoryId;
  const currentCategory = categories.find((category) => category.id === currentCategoryId) ?? categories[0];
  const visibleFields = fields
    .filter((field) => field.categoryId === currentCategoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const categoryMatch = activeCategoryFilter === "all" || item.categoryId === activeCategoryFilter;
        const tagMatch = activeTagFilter === "all" || item.tagIds.includes(activeTagFilter);
        return categoryMatch && tagMatch;
      }),
    [activeCategoryFilter, activeTagFilter, items]
  );

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedOrder = purchases.find((purchase) => purchase.id === selectedOrderId) ?? null;
  const selectedOrderItems = items.filter((item) => item.purchaseId === selectedOrder?.id);
  const unboundItems = items.filter((item) => item.purchaseId !== selectedOrder?.id);

  const suggestionValues = (field: CustomField) => {
    const values = items
      .map((item) => item.customValues[field.id])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    return Array.from(new Set(values));
  };

  const onAddImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = await toDataUrl(file);
    setDraft((current) => ({ ...current, imageUrl }));
  };

  const onEditImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingItemId) return;
    const imageUrl = await toDataUrl(file);
    setEditDraft((current) => ({ ...current, imageUrl }));
  };

  const submitItem = (event: FormEvent) => {
    event.preventDefault();
    const name = buildItemName(currentCategory?.name ?? "藏品", draft.customValues);
    addItem({
      ...draft,
      categoryId: currentCategoryId,
      name
    });
    setDraft({ ...emptyDraft, categoryId: currentCategoryId });
  };

  const startEditItem = (item: CollectionItem) => {
    setEditingItemId(item.id);
    setEditDraft(item);
  };

  const submitEditItem = (event: FormEvent) => {
    event.preventDefault();
    if (!editingItemId) return;
    updateItem(editingItemId, {
      ...editDraft,
      name: buildItemName(
        categories.find((category) => category.id === (editDraft.categoryId ?? selectedItem?.categoryId))?.name ?? "藏品",
        (editDraft.customValues as CollectionItem["customValues"]) ?? {}
      )
    });
    setEditingItemId(null);
    setEditDraft({});
  };

  const createOrder = (event: FormEvent) => {
    event.preventDefault();
    addPurchase(orderDraft);
    setOrderDraft(emptyOrderDraft);
  };

  const openOrderDetail = (orderId: string) => {
    const purchase = purchases.find((entry) => entry.id === orderId);
    if (!purchase) return;
    setSelectedOrderId(orderId);
    setOrderDraft({
      merchant: purchase.merchant,
      platform: purchase.platform,
      paidAt: purchase.paidAt,
      title: purchase.title,
      orderNo: purchase.orderNo ?? "",
      itemAmount: purchase.itemAmount,
      shippingAmount: purchase.shippingAmount,
      currency: purchase.currency,
      sourceLink: purchase.sourceLink ?? "",
      notes: purchase.notes ?? ""
    });
    setEditingOrder(false);
    setShowOrderBind(false);
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
          <input
            checked={Boolean(value)}
            onChange={(event) => setValues({ ...values, [field.id]: event.target.checked })}
            type="checkbox"
          />
          <span>{field.name}</span>
        </label>
      );
    }

    if (field.type === "single") {
      return (
        <div className="field" key={field.id}>
          <label>{field.name}</label>
          <select
            value={String(value ?? "")}
            onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
          >
            <option value="">请选择</option>
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
    <Screen title="仓库" subtitle="仓库页已经拆成默认仓库、新增藏品、订单管理三个工作流。">
      <Section title="仓库导航">
        <Row wrap>
          <Chip label="默认仓库" active={view === "library"} onClick={() => setView("library")} />
          <Chip label="新增藏品" active={view === "create"} onClick={() => setView("create")} />
          <Chip label="订单管理" active={view === "orders"} onClick={() => setView("orders")} />
        </Row>
      </Section>

      {view === "library" ? (
        <Section title="默认仓库" copy="这里先只显示图片。按分类或标签筛选，点击藏品进入详情。">
          <Card>
            <Stack>
              <Row wrap>
                <Chip label="全部分类" active={activeCategoryFilter === "all"} onClick={() => setActiveCategoryFilter("all")} />
                {categories.map((category) => (
                  <Chip key={category.id} label={category.name} active={activeCategoryFilter === category.id} onClick={() => setActiveCategoryFilter(category.id)} />
                ))}
              </Row>
              <Row wrap>
                <Chip label="全部标签" active={activeTagFilter === "all"} onClick={() => setActiveTagFilter("all")} />
                {tags.map((tag) => (
                  <Chip key={tag.id} label={tag.name} active={activeTagFilter === tag.id} onClick={() => setActiveTagFilter(tag.id)} />
                ))}
              </Row>
            </Stack>
          </Card>

          <div className="image-grid">
            {filteredItems.map((item) => (
              <button className="image-tile" key={item.id} onClick={() => setSelectedItemId(item.id)} type="button">
                {item.imageUrl ? <img alt={item.name} src={item.imageUrl} /> : <div className="image-tile-placeholder">{item.name}</div>}
              </button>
            ))}
          </div>

          {selectedItem ? (
            <div className="modal-backdrop" onClick={() => { setSelectedItemId(null); setEditingItemId(null); }}>
              <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
                <Row between>
                  <strong>{selectedItem.name}</strong>
                  <Button label="关闭" onClick={() => { setSelectedItemId(null); setEditingItemId(null); }} tone="quiet" />
                </Row>

                {editingItemId === selectedItem.id ? (
                  <form onSubmit={submitEditItem}>
                    <div className="detail-layout">
                      <div className="detail-image">
                        {String(editDraft.imageUrl ?? selectedItem.imageUrl ?? "").trim() ? (
                          <img alt={selectedItem.name} src={String(editDraft.imageUrl ?? selectedItem.imageUrl)} />
                        ) : (
                          <div className="image-tile-placeholder">暂无图片</div>
                        )}
                      </div>
                      <Stack>
                        <Row>
                          <Button label="选择图库/拍照" onClick={() => editImageInputRef.current?.click()} tone="quiet" />
                          <input accept="image/*" capture="environment" hidden onChange={onEditImage} ref={editImageInputRef} type="file" />
                        </Row>
                        <Field label="实体存放位置" value={String(editDraft.storageLocation ?? "")} onChange={(value) => setEditDraft((current) => ({ ...current, storageLocation: value }))} />
                        <Field label="卡价" type="number" value={String(editDraft.price ?? "")} onChange={(value) => setEditDraft((current) => ({ ...current, price: value ? Number(value) : undefined }))} />
                        <Field label="购买时间" type="date" value={String(editDraft.purchaseDate ?? "")} onChange={(value) => setEditDraft((current) => ({ ...current, purchaseDate: value }))} />
                        <Field label="购买金额" type="number" value={String(editDraft.purchaseAmount ?? "")} onChange={(value) => setEditDraft((current) => ({ ...current, purchaseAmount: value ? Number(value) : undefined }))} />
                      </Stack>
                    </div>
                    <div className="form-grid">
                      {fields
                        .filter((field) => field.categoryId === selectedItem.categoryId)
                        .sort((left, right) => left.sortOrder - right.sortOrder)
                        .map((field) =>
                          renderFieldInput(
                            field,
                            (editDraft.customValues as CollectionItem["customValues"]) ?? selectedItem.customValues,
                            (next) => setEditDraft((current) => ({ ...current, customValues: next }))
                          )
                        )}
                    </div>
                    <Row>
                      <Button label="保存修改" type="submit" />
                      <Button
                        label="删除藏品"
                        tone="danger"
                        onClick={() => {
                          deleteItem(selectedItem.id);
                          setSelectedItemId(null);
                          setEditingItemId(null);
                        }}
                      />
                    </Row>
                  </form>
                ) : (
                  <Stack>
                    <div className="detail-layout">
                      <div className="detail-image">
                        {selectedItem.imageUrl ? <img alt={selectedItem.name} src={selectedItem.imageUrl} /> : <div className="image-tile-placeholder">暂无图片</div>}
                      </div>
                      <Stack>
                        <span className="muted">状态：{statusLabels[selectedItem.status]}</span>
                        <span className="muted">位置：{selectedItem.storageLocation || "未记录"}</span>
                        <span className="muted">卡价：{selectedItem.price ? `¥${selectedItem.price}` : "未记录"}</span>
                        <span className="muted">购买时间：{selectedItem.purchaseDate || "未记录"}</span>
                        <span className="muted">购买金额：{selectedItem.purchaseAmount ? `¥${selectedItem.purchaseAmount}` : "未记录"}</span>
                        {fields
                          .filter((field) => field.categoryId === selectedItem.categoryId)
                          .sort((left, right) => left.sortOrder - right.sortOrder)
                          .map((field) => (
                            <span className="muted" key={field.id}>
                              {field.name}：{String(selectedItem.customValues[field.id] ?? "未填写")}
                            </span>
                          ))}
                      </Stack>
                    </div>
                    <Row>
                      <Button label="修改" onClick={() => startEditItem(selectedItem)} />
                      <Button
                        label="删除"
                        tone="danger"
                        onClick={() => {
                          deleteItem(selectedItem.id);
                          setSelectedItemId(null);
                        }}
                      />
                    </Row>
                  </Stack>
                )}
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {view === "create" ? (
        <Section title="新增藏品" copy="先选类别，再出现对应信息填写。卡牌公司为待选项，系列、球员名称、队伍支持高频自动补全。">
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
                        setDraft((current) => ({ ...current, categoryId: category.id, customValues: {}, tagIds: category.name === "卡牌" ? ["tag-football"] : [] }));
                      }}
                    />
                  ))}
                </Row>

                <div className="integrated-form">
                  <div className="detail-image uploader-tile">
                    {draft.imageUrl ? <img alt="藏品预览" src={draft.imageUrl} /> : <div className="image-tile-placeholder">添加图片</div>}
                    <Button label="选择图库/拍照" onClick={() => addImageInputRef.current?.click()} tone="quiet" />
                    <input accept="image/*" capture="environment" hidden onChange={onAddImage} ref={addImageInputRef} type="file" />
                  </div>

                  <div className="form-grid">
                    <Field label="实体存放位置" value={draft.storageLocation ?? ""} onChange={(value) => setDraft((current) => ({ ...current, storageLocation: value }))} placeholder="例如：卡盒 A / 第 1 排" />
                    <Field label="卡价" type="number" value={String(draft.price ?? "")} onChange={(value) => setDraft((current) => ({ ...current, price: value ? Number(value) : undefined }))} placeholder="例如：132" />
                    {visibleFields.map((field) =>
                      renderFieldInput(field, draft.customValues, (next) => setDraft((current) => ({ ...current, customValues: next })))
                    )}
                  </div>
                </div>

                <Row>
                  <Button label="添加" type="submit" />
                </Row>
              </Stack>
            </form>
          </Card>
        </Section>
      ) : null}

      {view === "orders" ? (
        <Section title="订单管理" copy="保留现在的订单列表布局；点击订单后弹出详情页，在详情页里完成查看、修改、删除和绑定藏品。">
          <Row>
            <Button label="新增订单" onClick={() => { setSelectedOrderId("new"); setOrderDraft(emptyOrderDraft); setEditingOrder(true); setShowOrderBind(false); }} />
          </Row>

          <div className="split-layout">
            <Card>
              <Stack>
                <strong>订单列表</strong>
                {purchases.map((purchase) => (
                  <button className={`list-row ${selectedOrder?.id === purchase.id ? "active" : ""}`.trim()} key={purchase.id} onClick={() => openOrderDetail(purchase.id)} type="button">
                    <span>{purchase.title || purchase.orderNo || "未命名订单"}</span>
                    <span className="muted">¥{purchase.totalAmount}</span>
                  </button>
                ))}
              </Stack>
            </Card>

            <Card>
              <EmptyState title="点击订单查看详情" copy="订单详情会以弹层形式打开，避免打乱当前列表浏览节奏。" />
            </Card>
          </div>

          {selectedOrderId ? (
            <div className="modal-backdrop" onClick={() => { setSelectedOrderId(null); setShowOrderBind(false); }}>
              <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
                <Row between>
                  <strong>{selectedOrderId === "new" ? "新增订单" : "订单详情"}</strong>
                  <Button label="关闭" onClick={() => { setSelectedOrderId(null); setShowOrderBind(false); }} tone="quiet" />
                </Row>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (selectedOrderId === "new") {
                      createOrder(event);
                      setSelectedOrderId(null);
                      return;
                    }
                    updatePurchase(selectedOrderId, orderDraft);
                    setEditingOrder(false);
                  }}
                >
                  <div className="form-grid">
                    <Field label="订单标题" value={orderDraft.title} onChange={(value) => setOrderDraft((current) => ({ ...current, title: value }))} />
                    <Field label="商家" value={orderDraft.merchant} onChange={(value) => setOrderDraft((current) => ({ ...current, merchant: value }))} />
                    <Field label="平台" value={orderDraft.platform} onChange={(value) => setOrderDraft((current) => ({ ...current, platform: value }))} />
                    <Field label="订单号" value={orderDraft.orderNo ?? ""} onChange={(value) => setOrderDraft((current) => ({ ...current, orderNo: value }))} />
                    <Field label="付款日期" type="date" value={orderDraft.paidAt} onChange={(value) => setOrderDraft((current) => ({ ...current, paidAt: value }))} />
                    <Field label="商品金额" type="number" value={String(orderDraft.itemAmount || "")} onChange={(value) => setOrderDraft((current) => ({ ...current, itemAmount: value ? Number(value) : 0 }))} />
                    <Field label="邮费" type="number" value={String(orderDraft.shippingAmount || "")} onChange={(value) => setOrderDraft((current) => ({ ...current, shippingAmount: value ? Number(value) : 0 }))} />
                    <Field label="链接" value={orderDraft.sourceLink ?? ""} onChange={(value) => setOrderDraft((current) => ({ ...current, sourceLink: value }))} />
                  </div>
                  <Field label="备注" value={orderDraft.notes ?? ""} onChange={(value) => setOrderDraft((current) => ({ ...current, notes: value }))} textarea />

                  {selectedOrder && selectedOrderId !== "new" ? (
                    <>
                      <Section title="已关联藏品">
                        {selectedOrderItems.length > 0 ? (
                          <div className="compact-list">
                            {selectedOrderItems.map((item) => (
                              <div className="list-row static" key={item.id}>
                                <span>{item.name}</span>
                                <span className="muted">{item.purchaseAmount ? `¥${item.purchaseAmount}` : "未同步金额"}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState title="尚未关联藏品" copy="点击下面的按钮，为订单绑定一个或多个藏品。" />
                        )}
                      </Section>

                      <Row>
                        <Button label={showOrderBind ? "收起关联" : "关联藏品"} onClick={() => setShowOrderBind((value) => !value)} tone="quiet" />
                      </Row>

                      {showOrderBind ? (
                        <Section title="选择藏品进行关联">
                          <div className="compact-list">
                            {unboundItems.map((item) => (
                              <button className="list-row" key={item.id} onClick={() => linkPurchaseToItem(selectedOrder.id, item.id)} type="button">
                                <span>{item.name}</span>
                                <span className="muted">点击关联</span>
                              </button>
                            ))}
                          </div>
                        </Section>
                      ) : null}
                    </>
                  ) : null}

                  <Row>
                    <Button label={selectedOrderId === "new" ? "新增订单" : "保存订单"} type="submit" />
                    {selectedOrderId !== "new" && selectedOrder ? (
                      <Button
                        label="删除订单"
                        tone="danger"
                        onClick={() => {
                          deletePurchase(selectedOrder.id);
                          setSelectedOrderId(null);
                          setShowOrderBind(false);
                        }}
                      />
                    ) : null}
                  </Row>
                </form>
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}
