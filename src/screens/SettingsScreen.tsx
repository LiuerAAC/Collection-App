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
    storageStatus,
    syncConfig,
    addCategory,
    updateCategory,
    deleteCategory,
    addField,
    updateField,
    deleteField,
    moveField,
    addTag,
    updateTag,
    deleteTag,
    mergeTags,
    updateSyncConfig,
    exportBackup,
    pushToCloud,
    pullFromCloud
  } = useCollection();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? "");
  const [fieldDraft, setFieldDraft] = useState({ name: "", type: "text" as FieldType, options: "", autocomplete: false });
  const [newTagName, setNewTagName] = useState("");
  const [sourceTagId, setSourceTagId] = useState("");
  const [targetTagId, setTargetTagId] = useState("");
  const [openSection, setOpenSection] = useState<"storage" | "categories" | "fields" | "tags" | null>("categories");
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  const confirmDelete = (message: string, action: () => void) => {
    if (window.confirm(message)) {
      action();
    }
  };

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

  const submitTagMerge = (event: FormEvent) => {
    event.preventDefault();
    if (!sourceTagId || !targetTagId || sourceTagId === targetTagId) return;
    const source = tags.find((tag) => tag.id === sourceTagId);
    const target = tags.find((tag) => tag.id === targetTagId);
    if (!source || !target) return;
    if (window.confirm(`Combine "${source.name}" into "${target.name}"? This will update all linked items.`)) {
      mergeTags(sourceTagId, targetTagId);
      setSourceTagId("");
      setTargetTagId("");
    }
  };

  const onFieldDrop = (targetId: string) => {
    if (!draggingFieldId || draggingFieldId === targetId) return;
    const index = scopedFields.findIndex((field) => field.id === targetId);
    if (index >= 0) {
      moveField(draggingFieldId, index);
    }
    setDraggingFieldId(null);
  };

  const toggleSection = (section: "storage" | "categories" | "fields" | "tags") => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const updateAutoSyncInterval = (value: string) => {
    const interval = Number(value);
    updateSyncConfig({ autoSyncIntervalMinutes: Number.isFinite(interval) ? Math.max(1, interval) : 10 });
  };

  const lastBackupLabel = storageStatus.lastSyncedAt
    ? new Date(storageStatus.lastSyncedAt).toLocaleString()
    : storageStatus.syncInFlight && storageStatus.syncAction === "pull"
      ? "Checking cloud..."
      : storageStatus.cloudSyncChecked
        ? "No cloud backup found"
        : "Not checked yet";

  return (
    <Screen title="Settings" subtitle="Edit categories, fields, and tags in one place.">
      <Section title="Template editor">
        <div className="settings-stack">
          <div className="accordion">
            <button className="accordion-header" onClick={() => toggleSection("categories")} type="button">
              <div className="accordion-title">
                <strong>Categories</strong>
              </div>
              <span className="muted">{openSection === "categories" ? "Hide" : "Show"}</span>
            </button>
            {openSection === "categories" ? (
              <div className="accordion-body dense-stack">
                <form onSubmit={submitCategory}>
                  <div className="toolbar-row">
                    <Field label="New category" value={newCategoryName} onChange={setNewCategoryName} placeholder="Football" />
                    <Button className="compact-button" label="Add" type="submit" />
                  </div>
                </form>
                {categories.map((category) => (
                  <div className="editable-row" key={category.id}>
                    <input className="inline-input" onChange={(event) => updateCategory(category.id, { name: event.target.value })} value={category.name} />
                    <Row>
                      <Button className="compact-button" label="Fields" onClick={() => { setSelectedCategoryId(category.id); setOpenSection("fields"); }} tone={selectedCategoryId === category.id ? "primary" : "quiet"} />
                      <Button className="compact-button" label="Delete" onClick={() => confirmDelete("Delete this category and its fields?", () => deleteCategory(category.id))} tone="danger" />
                    </Row>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="accordion">
            <button className="accordion-header" onClick={() => toggleSection("fields")} type="button">
              <div className="accordion-title">
                <strong>Fields</strong>
              </div>
              <span className="muted">{openSection === "fields" ? "Hide" : "Show"}</span>
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
                    <Field label="Field name" value={fieldDraft.name} onChange={(value) => setFieldDraft((current) => ({ ...current, name: value }))} />
                    <div className="field">
                      <label>Field type</label>
                      <select value={fieldDraft.type} onChange={(event) => setFieldDraft((current) => ({ ...current, type: event.target.value as FieldType }))}>
                        {fieldTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Field label="Options" value={fieldDraft.options} onChange={(value) => setFieldDraft((current) => ({ ...current, options: value }))} placeholder="Topps, Panini" />
                    <label className="checkbox-field">
                      <input checked={fieldDraft.autocomplete} onChange={(event) => setFieldDraft((current) => ({ ...current, autocomplete: event.target.checked }))} type="checkbox" />
                      <span>Autocomplete</span>
                    </label>
                  </div>
                  <Row>
                    <Button className="compact-button" label="Add field" type="submit" />
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
                            <Field label="Field name" value={field.name} onChange={(value) => updateField(field.id, { name: value })} />
                            <div className="field">
                              <label>Field type</label>
                              <select value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value as FieldType })}>
                                {fieldTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Field
                              label="Options"
                              value={(field.options ?? []).join(", ")}
                              onChange={(value) => updateField(field.id, { options: value.split(",").map((entry) => entry.trim()).filter(Boolean) })}
                            />
                            <label className="checkbox-field">
                              <input checked={Boolean(field.autocomplete)} onChange={(event) => updateField(field.id, { autocomplete: event.target.checked })} type="checkbox" />
                              <span>Autocomplete</span>
                            </label>
                          </div>
                          <Row>
                            <Button className="compact-button" label="Delete field" onClick={() => confirmDelete("Delete this field and clear saved values?", () => deleteField(field.id))} tone="danger" />
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
                <strong>Tags</strong>
              </div>
              <span className="muted">{openSection === "tags" ? "Hide" : "Show"}</span>
            </button>
            {openSection === "tags" ? (
              <div className="accordion-body dense-stack">
                <form onSubmit={submitTag}>
                  <div className="toolbar-row">
                    <Field label="New tag" value={newTagName} onChange={setNewTagName} placeholder="Football" />
                    <Button className="compact-button" label="Add tag" type="submit" />
                  </div>
                </form>
                <form onSubmit={submitTagMerge}>
                  <div className="toolbar-row tag-merge-row">
                    <div className="field">
                      <label>Combine tag</label>
                      <select value={sourceTagId} onChange={(event) => setSourceTagId(event.target.value)}>
                        <option value="">Select source</option>
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Into</label>
                      <select value={targetTagId} onChange={(event) => setTargetTagId(event.target.value)}>
                        <option value="">Select target</option>
                        {tags
                          .filter((tag) => tag.id !== sourceTagId)
                          .map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <Button className="compact-button" label="Combine tag" type="submit" tone="quiet" />
                  </div>
                </form>
                {tags.map((tag) => (
                  <div className="editable-row" key={tag.id}>
                    <input className="inline-input" onChange={(event) => updateTag(tag.id, { name: event.target.value })} value={tag.name} />
                    <Button className="compact-button" label="Delete" onClick={() => confirmDelete("Delete this tag?", () => deleteTag(tag.id))} tone="danger" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="accordion">
            <button className="accordion-header" onClick={() => toggleSection("storage")} type="button">
              <div className="accordion-title">
                <strong>Storage & sync</strong>
              </div>
              <span className="muted">{openSection === "storage" ? "Hide" : "Show"}</span>
            </button>
            {openSection === "storage" ? (
              <div className="accordion-body dense-stack">
                <div className="form-grid compact">
                  <div className="field">
                    <label>Last backup</label>
                    <div className="readonly-field">
                      {lastBackupLabel}
                    </div>
                  </div>
                  <Field
                    label="Auto backup interval (minutes)"
                    onChange={updateAutoSyncInterval}
                    placeholder="10"
                    type="number"
                    value={String(syncConfig.autoSyncIntervalMinutes ?? 10)}
                  />
                  <label className="checkbox-field">
                    <input checked={syncConfig.autoSync} onChange={(event) => updateSyncConfig({ autoSync: event.target.checked })} type="checkbox" />
                    <span>Auto backup when this page is open and online</span>
                  </label>
                </div>

                <div className="settings-note">
                  Auto backup currently means: while this webpage is open, if you are online and there are unsynced local changes, the app will automatically push them to Supabase at the interval above.
                </div>

                {storageStatus.lastError ? <div className="sync-error">{storageStatus.lastError}</div> : null}

                <Row>
                  <Button
                    className="compact-button"
                    label={storageStatus.syncInFlight && storageStatus.syncAction === "push" ? "Backing up..." : "Push to cloud"}
                    onClick={() => void pushToCloud()}
                    tone="quiet"
                  />
                  <Button
                    className="compact-button"
                    label={storageStatus.syncInFlight && storageStatus.syncAction === "pull" ? "Pulling..." : "Pull from cloud"}
                    onClick={() => void pullFromCloud()}
                    tone="quiet"
                  />
                  <Button className="compact-button" label="Export backup" onClick={exportBackup} tone="quiet" />
                </Row>
              </div>
            ) : null}
          </div>
        </div>
      </Section>
    </Screen>
  );
}
