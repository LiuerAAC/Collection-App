import { FormEvent, useMemo, useState } from "react";
import { Button, Card, EmptyState, IconButton, Row, Screen, Stack } from "../components/ui";
import { useCollection } from "../store/collectionStore";
import { Album } from "../types";

function displayImageUrl(entry: { imageUrl?: string; imageThumbUrl?: string; localPreviewUrl?: string }) {
  return String(entry.localPreviewUrl || entry.imageThumbUrl || entry.imageUrl || "");
}

const layoutMap = {
  "2x2": { rows: 2, columns: 2 },
  "3x3": { rows: 3, columns: 3 },
  "4x3": { rows: 4, columns: 3 }
};

const emptyContainerDraft: Omit<Album, "id"> = {
  name: "",
  containerType: "album",
  coverColor: "#E8F2FB",
  layoutType: "3x3",
  pageCount: 1,
  doubleSided: false
};

export function GalleryScreen() {
  const { albums, albumSlots, items, photoShots, addAlbum, updateAlbum, deleteAlbum, placeItemInAlbum, placePhotoInAlbum } = useCollection();
  const [activeAlbumId, setActiveAlbumId] = useState(albums[0]?.id ?? "");
  const [pageIndex, setPageIndex] = useState(0);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [pickerSlot, setPickerSlot] = useState<{ row: number; column: number } | null>(null);
  const [pickerSource, setPickerSource] = useState<"library" | "photo">("library");
  const [showContainerEditor, setShowContainerEditor] = useState(false);
  const [expandedContainerId, setExpandedContainerId] = useState<string | null>(null);
  const [containerDraft, setContainerDraft] = useState(emptyContainerDraft);
  const [infoTarget, setInfoTarget] = useState<{ type: "item" | "photo"; id: string } | null>(null);
  const [photoInfoItemId, setPhotoInfoItemId] = useState<string | null>(null);

  const container = albums.find((entry) => entry.id === activeAlbumId) ?? albums[0];
  const containerType = container?.containerType ?? "album";
  const layout = layoutMap[container?.layoutType ?? "3x3"];

  const slots = useMemo(() => {
    return Array.from({ length: layout.rows * layout.columns }, (_, index) => {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      const slot = albumSlots.find((entry) => entry.albumId === container?.id && entry.pageIndex === pageIndex && entry.row === row && entry.column === column);
      const item = items.find((entry) => entry.id === slot?.itemId);
      const photo = photoShots.find((entry) => entry.id === slot?.photoId);
      return { row, column, item, photo };
    });
  }, [albumSlots, container?.id, items, layout.columns, layout.rows, pageIndex, photoShots]);

  const sliderPages = useMemo(() => {
    const total = Math.max(1, container?.pageCount ?? 1);
    return Array.from({ length: total }, (_, index) => {
      const slot = albumSlots.find((entry) => entry.albumId === container?.id && entry.pageIndex === index);
      const item = items.find((entry) => entry.id === slot?.itemId) ?? null;
      const photo = photoShots.find((entry) => entry.id === slot?.photoId) ?? null;
      return { index, item, photo };
    });
  }, [albumSlots, container?.id, container?.pageCount, items, photoShots]);

  const activeSliderPage = sliderPages[Math.min(sliderIndex, sliderPages.length - 1)] ?? null;
  const activeSliderItem = activeSliderPage?.item ?? null;
  const activeSliderPhoto = activeSliderPage?.photo ?? null;
  const infoItem = infoTarget?.type === "item" ? items.find((entry) => entry.id === infoTarget.id) ?? null : null;
  const infoPhoto = infoTarget?.type === "photo" ? photoShots.find((entry) => entry.id === infoTarget.id) ?? null : null;
  const infoPhotoItems = items.filter((entry) => infoPhoto?.itemIds.includes(entry.id));
  const activeInfoPhotoItem = infoPhotoItems.find((entry) => entry.id === photoInfoItemId) ?? infoPhotoItems[0] ?? null;

  const submitContainer = (event: FormEvent) => {
    event.preventDefault();
    if (!containerDraft.name.trim()) return;
    const id = addAlbum({
      ...containerDraft,
      name: containerDraft.name.trim()
    });
    setActiveAlbumId(id);
    setContainerDraft(emptyContainerDraft);
    setPageIndex(0);
    setSliderIndex(0);
  };

  const startNewContainer = () => {
    setContainerDraft(emptyContainerDraft);
    setShowContainerEditor(true);
  };

  const newContainerForm = (
    <form onSubmit={submitContainer}>
      <div className="editable-row container-edit-row new-container-row">
        <input
          className="inline-input"
          onChange={(event) => setContainerDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="New container"
          value={containerDraft.name}
        />
        <select
          className="inline-input container-inline-select"
          onChange={(event) => setContainerDraft((current) => ({ ...current, containerType: event.target.value as Album["containerType"] }))}
          value={containerDraft.containerType}
        >
          <option value="album">Album</option>
          <option value="slider">Slider</option>
        </select>
        {containerDraft.containerType === "slider" ? (
          <input
            aria-label="Cards"
            className="inline-input container-inline-pages"
            min="1"
            onChange={(event) => setContainerDraft((current) => ({ ...current, pageCount: Math.max(1, Number(event.target.value || 1)) }))}
            placeholder="Cards"
            type="number"
            value={containerDraft.pageCount}
          />
        ) : (
          <>
            <select
              className="inline-input container-inline-select"
              onChange={(event) => setContainerDraft((current) => ({ ...current, layoutType: event.target.value as Album["layoutType"] }))}
              value={containerDraft.layoutType}
            >
              <option value="2x2">2 x 2</option>
              <option value="3x3">3 x 3</option>
              <option value="4x3">4 x 3</option>
            </select>
            <input
              aria-label="Pages"
              className="inline-input container-inline-pages"
              min="1"
              onChange={(event) => setContainerDraft((current) => ({ ...current, pageCount: Math.max(1, Number(event.target.value || 1)) }))}
              placeholder="Pages"
              type="number"
              value={containerDraft.pageCount}
            />
          </>
        )}
        <Button className="compact-button" label="Add" type="submit" />
      </div>
    </form>
  );

  const closePicker = () => {
    setPickerSlot(null);
  };

  const openInfo = (target: { type: "item" | "photo"; id: string }) => {
    setInfoTarget(target);
    if (target.type === "photo") {
      const photo = photoShots.find((entry) => entry.id === target.id);
      setPhotoInfoItemId(photo?.itemIds[0] ?? null);
    } else {
      setPhotoInfoItemId(null);
    }
  };

  if (!container) {
    return (
      <Screen title="Gallery" subtitle="Visual display containers live here.">
        <EmptyState title="No containers yet" copy="Create the first container and start placing images." action={<Button label="Add gallery" onClick={startNewContainer} />} />
        {showContainerEditor ? (
          <Card className="container-editor-card">
            <Stack>{newContainerForm}</Stack>
          </Card>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen title="Gallery" subtitle="Image-first display containers.">
      <section className="section">
        <div className="gallery-heading-row">
          <h3>Containers</h3>
          <button className="mini-icon-button" onClick={() => setShowContainerEditor((value) => !value)} title="Edit containers" type="button">
            Edit
          </button>
        </div>

        {showContainerEditor ? (
          <Card className="container-editor-card">
            <Stack>
              <div className="compact-list">
                {albums.map((entry) => (
                  <div className="container-edit-item" key={entry.id}>
                    <button
                      className={`container-edit-summary ${expandedContainerId === entry.id ? "active" : ""}`.trim()}
                      onClick={() => setExpandedContainerId((current) => (current === entry.id ? null : entry.id))}
                      type="button"
                    >
                      <span>{entry.name}</span>
                      <span className="muted">{expandedContainerId === entry.id ? "Hide" : "Edit"}</span>
                    </button>

                    {expandedContainerId === entry.id ? (
                      <div className="editable-row container-edit-row">
                        <input className="inline-input" onChange={(event) => updateAlbum(entry.id, { name: event.target.value })} value={entry.name} />
                        <select
                          className="inline-input container-inline-select"
                          onChange={(event) => updateAlbum(entry.id, { containerType: event.target.value as Album["containerType"] })}
                          value={entry.containerType ?? "album"}
                        >
                          <option value="album">Album</option>
                          <option value="slider">Slider</option>
                        </select>
                        {entry.containerType === "slider" ? (
                          <input
                            aria-label="Cards"
                            className="inline-input container-inline-pages"
                            min="1"
                            onChange={(event) => updateAlbum(entry.id, { pageCount: Math.max(1, Number(event.target.value || 1)) })}
                            placeholder="Cards"
                            type="number"
                            value={entry.pageCount}
                          />
                        ) : (
                          <>
                            <select
                              className="inline-input container-inline-select"
                              onChange={(event) => updateAlbum(entry.id, { layoutType: event.target.value as Album["layoutType"] })}
                              value={entry.layoutType}
                            >
                              <option value="2x2">2 x 2</option>
                              <option value="3x3">3 x 3</option>
                              <option value="4x3">4 x 3</option>
                            </select>
                            <input
                              aria-label="Pages"
                              className="inline-input container-inline-pages"
                              min="1"
                              onChange={(event) => updateAlbum(entry.id, { pageCount: Math.max(1, Number(event.target.value || 1)) })}
                              placeholder="Pages"
                              type="number"
                              value={entry.pageCount}
                            />
                          </>
                        )}
                        <div className="toolbar-row">
                          <Button
                            className="compact-button"
                            label="Delete"
                            onClick={() => {
                              if (window.confirm("Delete this container?")) {
                                deleteAlbum(entry.id);
                                if (activeAlbumId === entry.id) {
                                  setActiveAlbumId(albums.find((album) => album.id !== entry.id)?.id ?? "");
                                }
                                setExpandedContainerId((current) => (current === entry.id ? null : current));
                              }
                            }}
                            tone="danger"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {newContainerForm}
            </Stack>
          </Card>
        ) : null}

        <div className="container-rail single-line">
          {albums.map((entry) => (
            <button
              className={`container-chip ${entry.id === container.id ? "active" : ""}`.trim()}
              key={entry.id}
              onClick={() => {
                setActiveAlbumId(entry.id);
                setPageIndex(0);
                setSliderIndex(0);
              }}
              type="button"
            >
              <span className={`container-chip-dot ${(entry.containerType ?? "album")}`.trim()} />
              <span>{entry.name}</span>
            </button>
          ))}
        </div>
      </section>

      {containerType === "album" ? (
        <Card>
          <Stack>
            <div className="album-sheet">
              <div className="album-grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
                {slots.map((slot) => (
                  <div className="slot-shell" key={`${slot.row}-${slot.column}`}>
                    <button className="slot image-slot" onClick={() => setPickerSlot({ row: slot.row, column: slot.column })} type="button">
                      {slot.photo?.imageUrl ? (
                        <img alt={slot.photo.title ?? "Photo"} src={displayImageUrl(slot.photo)} />
                      ) : slot.item?.imageUrl ? (
                        <img alt={slot.item.name} src={displayImageUrl(slot.item)} />
                      ) : (
                        <span className="slot-empty-dot" aria-hidden="true" />
                      )}
                    </button>
                    {slot.photo ? (
                      <button className="image-info-button gallery-info-button" onClick={() => openInfo({ type: "photo", id: slot.photo!.id })} title="Photo info" type="button">
                        i
                      </button>
                    ) : null}
                    {slot.item ? (
                      <button className="image-info-button gallery-info-button" onClick={() => openInfo({ type: "item", id: slot.item!.id })} title="Item info" type="button">
                        i
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <Row wrap>
              {Array.from({ length: container.pageCount }).map((_, index) => (
                <button className={`chip ${pageIndex === index ? "active" : ""}`.trim()} key={index} onClick={() => setPageIndex(index)} type="button">
                  {`Page ${index + 1}`}
                </button>
              ))}
            </Row>
          </Stack>
        </Card>
      ) : (
        <Card>
          <div className="slider-gallery">
            <button
              className="gallery-arrow"
              onClick={() =>
                setSliderIndex((value) => {
                  const total = Math.max(sliderPages.length, 1);
                  return (value - 1 + total) % total;
                })
              }
              type="button"
            >
              ‹
            </button>
            <div className="slider-stage-shell">
              <button className="slider-stage" onClick={() => setPickerSlot({ row: sliderIndex, column: 0 })} type="button">
                {activeSliderPhoto?.imageUrl ? (
                  <img alt={activeSliderPhoto.title ?? "Photo"} src={displayImageUrl(activeSliderPhoto)} />
                ) : activeSliderItem?.imageUrl ? (
                  <img alt={activeSliderItem.name} src={displayImageUrl(activeSliderItem)} />
                ) : (
                  <div className="image-tile-placeholder">Tap to add</div>
                )}
              </button>
              {activeSliderPhoto ? (
                <button className="image-info-button gallery-info-button slider-info-button" onClick={() => openInfo({ type: "photo", id: activeSliderPhoto.id })} title="Photo info" type="button">
                  i
                </button>
              ) : null}
              {activeSliderItem ? (
                <button className="image-info-button gallery-info-button slider-info-button" onClick={() => openInfo({ type: "item", id: activeSliderItem.id })} title="Item info" type="button">
                  i
                </button>
              ) : null}
            </div>
            <button
              className="gallery-arrow"
              onClick={() =>
                setSliderIndex((value) => {
                  const total = Math.max(sliderPages.length, 1);
                  return (value + 1) % total;
                })
              }
              type="button"
            >
              ›
            </button>
          </div>
        </Card>
      )}

      {pickerSlot ? (
        <div className="modal-backdrop" onClick={closePicker}>
          <div className="modal-panel compact-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-topbar">
              <strong>Select item</strong>
              <IconButton label="Close" onClick={closePicker} />
            </div>
            <div className="picker-source-row">
              <button className={`chip ${pickerSource === "library" ? "active" : ""}`.trim()} onClick={() => setPickerSource("library")} type="button">
                Library
              </button>
              <button className={`chip ${pickerSource === "photo" ? "active" : ""}`.trim()} onClick={() => setPickerSource("photo")} type="button">
                Photo
              </button>
            </div>
            <div className="picker-grid">
              {pickerSource === "library"
                ? items.map((item) => (
                    <button
                      className="picker-card"
                      key={item.id}
                      onClick={() => {
                        placeItemInAlbum(container.id, containerType === "slider" ? sliderIndex : pageIndex, pickerSlot.row, pickerSlot.column, item.id);
                        closePicker();
                      }}
                      type="button"
                    >
                      <div className="picker-thumb">
                        {displayImageUrl(item) ? <img alt={item.name} src={displayImageUrl(item)} /> : <div className="image-tile-placeholder">No image</div>}
                      </div>
                      <span>{item.name}</span>
                    </button>
                  ))
                : photoShots.map((photo) => (
                    <button
                      className="picker-card"
                      key={photo.id}
                      onClick={() => {
                        placePhotoInAlbum(container.id, containerType === "slider" ? sliderIndex : pageIndex, pickerSlot.row, pickerSlot.column, photo.id);
                        closePicker();
                      }}
                      type="button"
                    >
                      <div className="picker-thumb">
                        <img alt={photo.title ?? "Photo"} src={displayImageUrl(photo)} />
                      </div>
                      <span>{photo.title || "Photo"}</span>
                    </button>
                  ))}
            </div>
          </div>
        </div>
      ) : null}

      {infoTarget ? (
        <div className="modal-backdrop" onClick={() => setInfoTarget(null)}>
          <div className="modal-panel compact-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-topbar">
              <strong>{infoTarget.type === "item" ? infoItem?.name ?? "Item info" : infoPhoto?.title ?? "Photo info"}</strong>
              <IconButton label="Close" onClick={() => setInfoTarget(null)} />
            </div>
            {infoItem ? (
              <div className="stack">
                <div className="detail-image compact-photo">
                  {displayImageUrl(infoItem) ? <img alt={infoItem.name} src={displayImageUrl(infoItem)} /> : <div className="image-tile-placeholder">No image</div>}
                </div>
                <strong>{infoItem.name}</strong>
                <span className="muted">{infoItem.storageLocation || "Storage not set"}</span>
              </div>
            ) : null}
            {infoPhoto ? (
              <div className="stack">
                <div className="detail-image compact-photo">
                  <img alt={infoPhoto.title ?? "Photo"} src={displayImageUrl(infoPhoto)} />
                </div>
                <div className="linked-thumb-row">
                  {infoPhotoItems.map((item, index) => (
                    <button
                      className={`linked-thumb ${activeInfoPhotoItem?.id === item.id ? "active" : ""}`.trim()}
                      key={item.id}
                      onClick={() => setPhotoInfoItemId(item.id)}
                      type="button"
                    >
                      <span className="linked-thumb-order">{index + 1}</span>
                      {displayImageUrl(item) ? <img alt={item.name} src={displayImageUrl(item)} /> : <span className="linked-thumb-fallback">{item.name.slice(0, 1)}</span>}
                    </button>
                  ))}
                </div>
                {activeInfoPhotoItem ? (
                  <div className="linked-item-card">
                    <div className="row">
                      <div className="thumb">
                        {displayImageUrl(activeInfoPhotoItem) ? <img alt={activeInfoPhotoItem.name} src={displayImageUrl(activeInfoPhotoItem)} /> : <div className="image-tile-placeholder">No image</div>}
                      </div>
                      <div className="stack">
                        <strong>{activeInfoPhotoItem.name}</strong>
                        <span className="muted">{activeInfoPhotoItem.storageLocation || "Storage not set"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="muted">No linked cards yet</span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
