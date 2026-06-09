import { DragEvent, FormEvent, useMemo, useState } from "react";
import { Button, Chip, Field, Row, Screen, Section, Stack } from "../components/ui";
import { useCollection } from "../store/collectionStore";
import { FieldType } from "../types";

const fieldTypes: FieldType[] = ["text", "number", "money", "date", "single", "multi", "boolean", "link"];

export function SettingsScreen() {
  const {
    categories,
    fields,
    tags,
    addCategory,
    updateCategory,
    deleteCategory,
    addField,
    updateField,
    deleteField,
    moveField,
    addTag,
    updateTag,
    deleteTag
  } = useCollection();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? "");
  const [fieldDraft, setFieldDraft] = useState({ name: "", type: "text" as FieldType, options: "", autocomplete: false });
  const [newTagName, setNewTagName] = useState("");
  const [openSection, setOpenSection] = useState<"categories" | "fields" | "tags" | null>("categories");
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  const scopedFields = useMemo(
    () =>
      fields
        .filter((field) => field.categoryId === selectedCategoryId)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [fields, selectedCategoryId]
  );

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim()) return;
    const id = addCategory(newCategoryName.trim());
    setSelectedCategoryId(id);
    setNewCategoryName("");
  };

  const submitField = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCategoryId || !fieldDraft.name.trim()) return;
    addField({
      categoryId: selectedCategoryId,
      name: fieldDraft.name.trim(),
      type: fieldDraft.type,
      options: fieldDraft.options.split(",").map((entry) => entry.trim()).filter(Boolean),
      autocomplete: fieldDraft.autocomplete
    });
    setFieldDraft({ name: "", type: "text", options: "", autocomplete: false });
  };

  const submitTag = (event: FormEvent) => {
    event.preventDefault();
    if (!newTagName.trim()) return;
    addTag(newTagName.trim());
    setNewTagName("");
  };

  const onFieldDrop = (targetId: string) => {
    if (!draggingFieldId || draggingFieldId === targetId) return;
    const index = scopedFields.findIndex((field) => field.id === targetId);
    if (index >= 0) {
      moveField(draggingFieldId, index);
    }
    setDraggingFieldId(null);
  };

  const toggleSection = (section: "categories" | "fields" | "tags") => {
    setOpenSection((current) => (current === section ? null : section));
  };

  return (
    <Screen title="设置" subtitle="模板、字段和标签都可以在这里调整，修改后会立即应用到仓库。">
      <Section title="分类模板编辑">
        <div className="settings-stack">
          <div className="accordion">
            <button className="accordion-header" onClick={() => toggleSection("categories")} type="button">
              <div className="accordion-title">
                <strong>分类管理</strong>
                <span className="muted">增删改分类，控制仓库中可选的大类。</span>
              </div>
              <span className="muted">{openSection === "categories" ? "收起" : "展开"}</span>
            </button>
            {openSection === "categories" ? (
              <div className="accordion-body dense-stack">
                <form onSubmit={submitCategory}>
                  <div className="toolbar-row">
                    <Field label="新增分类" value={newCategoryName} onChange={setNewCategoryName} placeholder="例如：足球" />
                    <Button label="添加" type="submit" />
                  </div>
                </form>
                {categories.map((category) => (
                  <div className="editable-row" key={category.id}>
                    <input className="inline-input" onChange={(event) => updateCategory(category.id, { name: event.target.value })} value={category.name} />
                    <Row>
                      <Button label="字段" onClick={() => { setSelectedCategoryId(category.id); setOpenSection("fields"); }} tone={selectedCategoryId === category.id ? "primary" : "quiet"} />
                      <Button label="删除" onClick={() => deleteCategory(category.id)} tone="danger" />
                    </Row>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="accordion">
            <button className="accordion-header" onClick={() => toggleSection("fields")} type="button">
              <div className="accordion-title">
                <strong>字段管理</strong>
                <span className="muted">字段保持折叠，点击单个字段后展开修改；支持拖动调整顺序。</span>
              </div>
              <span className="muted">{openSection === "fields" ? "收起" : "展开"}</span>
            </button>
            {openSection === "fields" ? (
              <div className="accordion-body dense-stack">
                <Row wrap>
                  {categories.map((category) => (
                    <Chip key={category.id} label={category.name} active={selectedCategoryId === category.id} onClick={() => setSelectedCategoryId(category.id)} />
                  ))}
                </Row>

                <form onSubmit={submitField}>
                  <div className="form-grid compact">
                    <Field label="字段名称" value={fieldDraft.name} onChange={(value) => setFieldDraft((current) => ({ ...current, name: value }))} />
                    <div className="field">
                      <label>字段类型</label>
                      <select value={fieldDraft.type} onChange={(event) => setFieldDraft((current) => ({ ...current, type: event.target.value as FieldType }))}>
                        {fieldTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Field label="选项" value={fieldDraft.options} onChange={(value) => setFieldDraft((current) => ({ ...current, options: value }))} placeholder="Topps, Panini" />
                    <label className="checkbox-field">
                      <input checked={fieldDraft.autocomplete} onChange={(event) => setFieldDraft((current) => ({ ...current, autocomplete: event.target.checked }))} type="checkbox" />
                      <span>自动补全</span>
                    </label>
                  </div>
                  <Row>
                    <Button label="添加字段" type="submit" />
                  </Row>
                </form>

                <div className="dense-stack">
                  {scopedFields.map((field) => (
                    <div key={field.id}>
                      <div
                        className={`field-summary ${expandedFieldId === field.id ? "active" : ""}`.trim()}
                        draggable
                        onClick={() => setExpandedFieldId((current) => (current === field.id ? null : field.id))}
                        onDragOver={(event) => event.preventDefault()}
                        onDragStart={() => setDraggingFieldId(field.id)}
                        onDrop={() => onFieldDrop(field.id)}
                      >
                        <span>{field.name}</span>
                        <span className="muted">{field.type}</span>
                      </div>
                      {expandedFieldId === field.id ? (
                        <div className="field-editor">
                          <div className="form-grid compact">
                            <Field label="字段名称" value={field.name} onChange={(value) => updateField(field.id, { name: value })} />
                            <div className="field">
                              <label>字段类型</label>
                              <select value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value as FieldType })}>
                                {fieldTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Field
                              label="选项"
                              value={(field.options ?? []).join(", ")}
                              onChange={(value) => updateField(field.id, { options: value.split(",").map((entry) => entry.trim()).filter(Boolean) })}
                            />
                            <label className="checkbox-field">
                              <input checked={Boolean(field.autocomplete)} onChange={(event) => updateField(field.id, { autocomplete: event.target.checked })} type="checkbox" />
                              <span>自动补全</span>
                            </label>
                          </div>
                          <Row>
                            <Button label="删除字段" onClick={() => deleteField(field.id)} tone="danger" />
                          </Row>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="accordion">
            <button className="accordion-header" onClick={() => toggleSection("tags")} type="button">
              <div className="accordion-title">
                <strong>全局标签</strong>
                <span className="muted">标签同样支持增删改，仓库筛选会直接使用这些内容。</span>
              </div>
              <span className="muted">{openSection === "tags" ? "收起" : "展开"}</span>
            </button>
            {openSection === "tags" ? (
              <div className="accordion-body dense-stack">
                <form onSubmit={submitTag}>
                  <div className="toolbar-row">
                    <Field label="新增标签" value={newTagName} onChange={setNewTagName} placeholder="例如：足球" />
                    <Button label="添加标签" type="submit" />
                  </div>
                </form>
                {tags.map((tag) => (
                  <div className="editable-row" key={tag.id}>
                    <input className="inline-input" onChange={(event) => updateTag(tag.id, { name: event.target.value })} value={tag.name} />
                    <Button label="删除" onClick={() => deleteTag(tag.id)} tone="danger" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Section>
    </Screen>
  );
}
