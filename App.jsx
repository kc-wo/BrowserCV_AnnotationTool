import { useEffect, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Text,
  Group,
  Line,
  Circle,
} from "react-konva";
import useImage from "use-image";
import "./App.css";

function App() {
  // =========================
  // Canvas Configuration
  // =========================

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // =========================
  // Dataset State
  // =========================

  const [images, setImages] = useState([]);
  const [currentImageId, setCurrentImageId] = useState(null);

  // =========================
  // Annotation State
  // =========================

  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState(null);
  const [inspectingAnnotation, setInspectingAnnotation] = useState(null);

  // =========================
  // Attribute Form State
  // =========================

  const [attributeKey, setAttributeKey] = useState("");
  const [attributeValue, setAttributeValue] = useState("");

  // =========================
  // Label State
  // =========================

  const [labels, setLabels] = useState([]);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#ff0000");
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelName, setEditingLabelName] = useState("");

  // =========================
  // Tool State
  // =========================

  const [activeTool, setActiveTool] = useState("select");

  // =========================
  // Bounding Box State
  // =========================

  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [boxStart, setBoxStart] = useState(null);
  const [draftBox, setDraftBox] = useState(null);
  const [resizingBox, setResizingBox] = useState(null);

  // =========================
  // Polygon State
  // =========================

  const [polygonPoints, setPolygonPoints] = useState([]);

  // =========================
  // Mask State
  // =========================

  const [isDrawingMask, setIsDrawingMask] = useState(false);
  const [currentMaskStroke, setCurrentMaskStroke] = useState(null);
  const [maskBrushSize, setMaskBrushSize] = useState(20);

  // =========================
  // View State
  // =========================

  const [zoomPercent, setZoomPercent] = useState(100);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });

  // =========================
  // History State
  // =========================

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // =========================
  // Current Image Setup
  // =========================

  const currentImage = images.find((image) => image.id === currentImageId);
  const [loadedImage] = useImage(currentImage?.src);

  const currentAnnotations = annotations.filter(
    (annotation) => annotation.imageId === currentImageId
  );

  // =========================
  // Zoom & Image Scaling
  // =========================

  const zoomOptions = Array.from({ length: 21 }, (_, index) => index * 10);
  const zoomScale = zoomPercent / 100;

  let fitScale = 1;
  let displayWidth = 0;
  let displayHeight = 0;

  if (loadedImage) {
    const widthScale = CANVAS_WIDTH / loadedImage.width;
    const heightScale = CANVAS_HEIGHT / loadedImage.height;

    fitScale = Math.min(widthScale, heightScale);
    displayWidth = loadedImage.width * fitScale;
    displayHeight = loadedImage.height * fitScale;
  }

  const imageX = -displayWidth / 2;
  const imageY = -displayHeight / 2;

  const layerX = CANVAS_WIDTH / 2 + panPosition.x;
  const layerY = CANVAS_HEIGHT / 2 + panPosition.y;

  // =========================
  // Coordinate Conversions
  // =========================

  const getImageCoordinates = (pointerPosition) => {
    const localX = (pointerPosition.x - layerX) / zoomScale;
    const localY = (pointerPosition.y - layerY) / zoomScale;

    return {
      x: (localX - imageX) / fitScale,
      y: (localY - imageY) / fitScale,
    };
  };

  const clampPointToImage = (point) => {
    if (!loadedImage) return point;

    return {
      x: Math.max(0, Math.min(loadedImage.width, point.x)),
      y: Math.max(0, Math.min(loadedImage.height, point.y)),
    };
  };

  // =========================
  // History Handlers
  // =========================

  const saveHistory = (nextAnnotations) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(structuredClone(nextAnnotations));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const applyAnnotationChange = (nextAnnotations) => {
    saveHistory(nextAnnotations);
    setAnnotations(nextAnnotations);
  };

  const handleUndo = () => {
    if (historyIndex < 0) return;
    const previousState = history[historyIndex - 1] || [];
    setAnnotations(structuredClone(previousState));
    setHistoryIndex(historyIndex - 1);
    setSelectedAnnotationId(null);
    setHoveredAnnotationId(null);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setAnnotations(structuredClone(history[nextIndex]));
    setHistoryIndex(nextIndex);
    setSelectedAnnotationId(null);
    setHoveredAnnotationId(null);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;

      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (
        (event.key.toLowerCase() === "z" && event.shiftKey) ||
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, historyIndex]);

  // =========================
  // Attribute Handlers
  // =========================

  const handleAddAttribute = (annotationId) => {
    const trimmedKey = attributeKey.trim();
    const trimmedValue = attributeValue.trim();

    if (!trimmedKey) return;

    const nextAnnotations = annotations.map((ann) => {
      if (ann.id !== annotationId) return ann;

      const updatedAttributes = {
        ...(ann.attributes || {}),
        [trimmedKey]: trimmedValue,
      };

      const updatedAnn = { ...ann, attributes: updatedAttributes };

      if (inspectingAnnotation?.id === annotationId) {
        setInspectingAnnotation(updatedAnn);
      }

      return updatedAnn;
    });

    applyAnnotationChange(nextAnnotations);
    setAttributeKey("");
    setAttributeValue("");
  };

  const handleRemoveAttribute = (annotationId, keyToRemove) => {
    const nextAnnotations = annotations.map((ann) => {
      if (ann.id !== annotationId) return ann;

      const updatedAttributes = { ...(ann.attributes || {}) };
      delete updatedAttributes[keyToRemove];

      const updatedAnn = { ...ann, attributes: updatedAttributes };

      if (inspectingAnnotation?.id === annotationId) {
        setInspectingAnnotation(updatedAnn);
      }

      return updatedAnn;
    });

    applyAnnotationChange(nextAnnotations);
  };

  // =========================
  // Drawing & Tools Setup
  // =========================

  const resetDrawingState = () => {
    setIsDrawingBox(false);
    setBoxStart(null);
    setDraftBox(null);
    setPolygonPoints([]);
    setIsDrawingMask(false);
    setCurrentMaskStroke(null);
    setResizingBox(null);
  };

  const activateTool = (tool) => {
    if (tool !== "select" && tool !== null && !selectedLabelId) return;

    resetDrawingState();
    setActiveTool(tool);

    if (tool !== "mask" && tool !== "mask-erase") {
      setSelectedAnnotationId(
        tool === "select" ? selectedAnnotationId : null
      );
    }
  };

  const isPannableTool = activeTool === null || activeTool === "select";

  const handlePanMove = (event) => {
    if (!isPannableTool) return;
    setPanPosition({
      x: event.target.x() - CANVAS_WIDTH / 2,
      y: event.target.y() - CANVAS_HEIGHT / 2,
    });
  };

  const isInsideImage = (point) => {
    if (!loadedImage) return false;
    return (
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= loadedImage.width &&
      point.y <= loadedImage.height
    );
  };

  // =========================
  // Canvas Mouse Actions
  // =========================

  const handleCanvasMouseDown = (event) => {
    if (!loadedImage) return;

    if (activeTool === "select") {
      if (event.target === event.target.getStage()) {
        setSelectedAnnotationId(null);
      }
      return;
    }

    if (!activeTool || !selectedLabelId) return;

    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    const imagePoint = clampPointToImage(
      getImageCoordinates(pointerPosition)
    );

    if (!isInsideImage(imagePoint)) return;

    if (activeTool === "bbox") {
      setIsDrawingBox(true);
      setBoxStart(imagePoint);
      setDraftBox({
        x: imagePoint.x,
        y: imagePoint.y,
        width: 0,
        height: 0,
      });
      setSelectedAnnotationId(null);
    }

    if (activeTool === "polygon") {
      setPolygonPoints((previousPoints) => [
        ...previousPoints,
        imagePoint.x,
        imagePoint.y,
      ]);
      setSelectedAnnotationId(null);
    }

    if (activeTool === "mask" || activeTool === "mask-erase") {
      if (maskBrushSize <= 0) return;
      setIsDrawingMask(true);
      setCurrentMaskStroke({
        points: [imagePoint.x, imagePoint.y],
        size: maskBrushSize,
        mode: activeTool === "mask" ? "draw" : "erase",
      });
    }
  };

  const handleCanvasMouseMove = (event) => {
    if (!loadedImage) return;

    if (activeTool === "bbox" && isDrawingBox && boxStart) {
      const stage = event.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;

      const imagePoint = clampPointToImage(
        getImageCoordinates(pointerPosition)
      );

      const x = Math.min(boxStart.x, imagePoint.x);
      const y = Math.min(boxStart.y, imagePoint.y);
      const endX = Math.max(boxStart.x, imagePoint.x);
      const endY = Math.max(boxStart.y, imagePoint.y);

      setDraftBox({ x, y, width: endX - x, height: endY - y });
      return;
    }

    if (
      (activeTool === "mask" || activeTool === "mask-erase") &&
      isDrawingMask &&
      currentMaskStroke
    ) {
      const stage = event.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;

      const imagePoint = clampPointToImage(
        getImageCoordinates(pointerPosition)
      );

      setCurrentMaskStroke((previousStroke) => ({
        ...previousStroke,
        points: [...previousStroke.points, imagePoint.x, imagePoint.y],
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (activeTool === "bbox" && isDrawingBox && boxStart && draftBox) {
      setIsDrawingBox(false);
      setBoxStart(null);

      if (draftBox.width < 2 || draftBox.height < 2) {
        setDraftBox(null);
        return;
      }

      const newAnnotation = {
        id: crypto.randomUUID(),
        imageId: currentImageId,
        type: "bbox",
        x: draftBox.x,
        y: draftBox.y,
        width: draftBox.width,
        height: draftBox.height,
        labelId: selectedLabelId,
        attributes: {},
      };

      const nextAnnotations = [...annotations, newAnnotation];
      applyAnnotationChange(nextAnnotations);
      setSelectedAnnotationId(newAnnotation.id);
      setDraftBox(null);
      setActiveTool("select");
      return;
    }

    if (
      (activeTool === "mask" || activeTool === "mask-erase") &&
      isDrawingMask &&
      currentMaskStroke
    ) {
      setIsDrawingMask(false);

      if (currentMaskStroke.points.length < 4) {
        setCurrentMaskStroke(null);
        return;
      }

      if (activeTool === "mask") {
        const selectedMask = annotations.find(
          (annotation) =>
            annotation.id === selectedAnnotationId &&
            annotation.imageId === currentImageId &&
            annotation.type === "mask" &&
            annotation.labelId === selectedLabelId
        );

        if (selectedMask) {
          const nextAnnotations = annotations.map((annotation) =>
            annotation.id === selectedMask.id
              ? {
                  ...annotation,
                  strokes: [...annotation.strokes, currentMaskStroke],
                }
              : annotation
          );

          applyAnnotationChange(nextAnnotations);
          setCurrentMaskStroke(null);
          setActiveTool("select");
          return;
        }

        const newAnnotation = {
          id: crypto.randomUUID(),
          imageId: currentImageId,
          type: "mask",
          labelId: selectedLabelId,
          strokes: [currentMaskStroke],
          attributes: {},
        };

        const nextAnnotations = [...annotations, newAnnotation];
        applyAnnotationChange(nextAnnotations);
        setSelectedAnnotationId(newAnnotation.id);
        setCurrentMaskStroke(null);
        setActiveTool("select");
        return;
      }

      if (activeTool === "mask-erase") {
        const selectedMask = annotations.find(
          (annotation) =>
            annotation.id === selectedAnnotationId &&
            annotation.imageId === currentImageId &&
            annotation.type === "mask"
        );

        if (!selectedMask) {
          setCurrentMaskStroke(null);
          return;
        }

        const nextAnnotations = annotations.map((annotation) =>
          annotation.id === selectedMask.id
            ? {
                ...annotation,
                strokes: [...annotation.strokes, currentMaskStroke],
              }
            : annotation
        );

        applyAnnotationChange(nextAnnotations);
        setCurrentMaskStroke(null);
        setActiveTool("select");
      }
    }
  };

  const finishPolygon = () => {
    if (activeTool !== "polygon" || polygonPoints.length < 6) return;

    const newAnnotation = {
      id: crypto.randomUUID(),
      imageId: currentImageId,
      type: "polygon",
      points: polygonPoints,
      labelId: selectedLabelId,
      attributes: {},
    };

    const nextAnnotations = [...annotations, newAnnotation];
    applyAnnotationChange(nextAnnotations);
    setSelectedAnnotationId(newAnnotation.id);
    setPolygonPoints([]);
    setActiveTool("select");
  };

  // =========================
  // Annotation Dragging
  // =========================

  const handleAnnotationDragEnd = (annotationId, event) => {
    const node = event.target;
    const dx = node.x() / fitScale;
    const dy = node.y() / fitScale;

    node.x(0);
    node.y(0);

    const nextAnnotations = annotations.map((annotation) => {
      if (annotation.id !== annotationId) return annotation;

      if (annotation.type === "bbox") {
        return {
          ...annotation,
          x: Math.max(
            0,
            Math.min(loadedImage.width - annotation.width, annotation.x + dx)
          ),
          y: Math.max(
            0,
            Math.min(loadedImage.height - annotation.height, annotation.y + dy)
          ),
        };
      }

      if (annotation.type === "polygon") {
        const updatedPoints = annotation.points.map((pt, index) =>
          index % 2 === 0 ? pt + dx : pt + dy
        );
        return { ...annotation, points: updatedPoints };
      }

      if (annotation.type === "mask") {
        const updatedStrokes = annotation.strokes.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((pt, index) =>
            index % 2 === 0 ? pt + dx : pt + dy
          ),
        }));
        return { ...annotation, strokes: updatedStrokes };
      }

      return annotation;
    });

    applyAnnotationChange(nextAnnotations);
  };

  // =========================
  // Selection & Editing
  // =========================

  const handleAnnotationSelect = (annotationId, event) => {
    if (activeTool !== "select") return;
    if (event) event.cancelBubble = true;
    setSelectedAnnotationId(annotationId);
  };

  const handleAnnotationHover = (annotationId) => {
    setHoveredAnnotationId(annotationId);
  };

  const handleAnnotationLeave = () => {
    setHoveredAnnotationId(null);
  };

  const handlePolygonPointDrag = (annotationId, pointIndex, event) => {
    const node = event.target;
    const x = (node.x() - imageX) / fitScale;
    const y = (node.y() - imageY) / fitScale;

    const clampedX = Math.max(0, Math.min(loadedImage.width, x));
    const clampedY = Math.max(0, Math.min(loadedImage.height, y));

    setAnnotations((previousAnnotations) =>
      previousAnnotations.map((annotation) => {
        if (annotation.id !== annotationId) return annotation;
        const nextPoints = [...annotation.points];
        nextPoints[pointIndex * 2] = clampedX;
        nextPoints[pointIndex * 2 + 1] = clampedY;
        return { ...annotation, points: nextPoints };
      })
    );
  };

  const handlePolygonPointDragEnd = () => {
    saveHistory(annotations);
  };

  const startBoxResize = (annotation, handle, event) => {
    event.cancelBubble = true;
    if (activeTool !== "select") return;

    setSelectedAnnotationId(annotation.id);
    setResizingBox({
      annotationId: annotation.id,
      handle,
      startX: annotation.x,
      startY: annotation.y,
      startWidth: annotation.width,
      startHeight: annotation.height,
    });
  };

  const handleBoxResizeMove = (event) => {
    if (!resizingBox) return;
    const stage = event.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    const point = clampPointToImage(getImageCoordinates(pointerPosition));

    setAnnotations((previousAnnotations) =>
      previousAnnotations.map((annotation) => {
        if (annotation.id !== resizingBox.annotationId) return annotation;

        let left = resizingBox.startX;
        let top = resizingBox.startY;
        let right = resizingBox.startX + resizingBox.startWidth;
        let bottom = resizingBox.startY + resizingBox.startHeight;

        if (resizingBox.handle.includes("left")) {
          left = Math.min(point.x, right - 2);
        }
        if (resizingBox.handle.includes("right")) {
          right = Math.max(point.x, left + 2);
        }
        if (resizingBox.handle.includes("top")) {
          top = Math.min(point.y, bottom - 2);
        }
        if (resizingBox.handle.includes("bottom")) {
          bottom = Math.max(point.y, top + 2);
        }

        return {
          ...annotation,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        };
      })
    );
  };

  const finishBoxResize = () => {
    if (!resizingBox) return;
    saveHistory(annotations);
    setResizingBox(null);
  };

  const handleDeleteAnnotationById = (annotationId) => {
    const nextAnnotations = annotations.filter(
      (annotation) => annotation.id !== annotationId
    );

    applyAnnotationChange(nextAnnotations);
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(null);
    }
    if (hoveredAnnotationId === annotationId) {
      setHoveredAnnotationId(null);
    }
  };

  // =========================
  // Label Actions
  // =========================

  const handleCreateLabel = () => {
    const trimmedName = newLabelName.trim();
    if (!trimmedName) return;

    const duplicate = labels.some(
      (label) => label.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) return;

    const newLabel = {
      id: crypto.randomUUID(),
      name: trimmedName,
      color: newLabelColor,
    };

    setLabels((previousLabels) => [...previousLabels, newLabel]);
    setSelectedLabelId(newLabel.id);
    setNewLabelName("");
  };

  const startRenameLabel = (label) => {
    setEditingLabelId(label.id);
    setEditingLabelName(label.name);
  };

  const saveRenameLabel = () => {
    const trimmedName = editingLabelName.trim();
    if (!editingLabelId || !trimmedName) return;

    const duplicate = labels.some(
      (label) =>
        label.id !== editingLabelId &&
        label.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) return;

    setLabels((previousLabels) =>
      previousLabels.map((label) =>
        label.id === editingLabelId ? { ...label, name: trimmedName } : label
      )
    );

    setEditingLabelId(null);
    setEditingLabelName("");
  };

  const handleDeleteLabel = (labelId) => {
    setLabels((previousLabels) =>
      previousLabels.filter((label) => label.id !== labelId)
    );

    const nextAnnotations = annotations.map((annotation) =>
      annotation.labelId === labelId
        ? { ...annotation, labelId: null }
        : annotation
    );

    setAnnotations(nextAnnotations);

    if (selectedLabelId === labelId) {
      setSelectedLabelId("");
      setActiveTool("select");
    }
  };

  // =========================
  // Image Navigation & Views
  // =========================

  const resetView = () => {
    setZoomPercent(100);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleImageImport = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const newImages = files
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        src: URL.createObjectURL(file),
      }));

    setImages((previousImages) => [...previousImages, ...newImages]);

    if (!currentImageId && newImages.length > 0) {
      setCurrentImageId(newImages[0].id);
    }

    event.target.value = "";
  };

  const handleImageSelect = (imageId) => {
    setCurrentImageId(imageId);
    setSelectedAnnotationId(null);
    setHoveredAnnotationId(null);
    setActiveTool("select");
    resetDrawingState();
    resetView();
  };

  const currentImageIndex = images.findIndex(
    (image) => image.id === currentImageId
  );

  const handlePreviousImage = () => {
    if (currentImageIndex <= 0) return;
    handleImageSelect(images[currentImageIndex - 1].id);
  };

  const handleNextImage = () => {
    if (
      currentImageIndex === -1 ||
      currentImageIndex >= images.length - 1
    ) return;
    handleImageSelect(images[currentImageIndex + 1].id);
  };

  // =========================
  // Export Processing
  // =========================

  const formatAnnotationForExport = (ann) => {
    const assignedLabel = labels.find((l) => l.id === ann.labelId);
    const baseAnnotation = {
      id: ann.id,
      type: ann.type,
      labelId: ann.labelId,
      labelName: assignedLabel ? assignedLabel.name : null,
      attributes: ann.attributes || {},
    };

    if (ann.type === "bbox") {
      return {
        ...baseAnnotation,
        coordinates: {
          units: "pixels",
          x: Number(ann.x.toFixed(2)),
          y: Number(ann.y.toFixed(2)),
          width: Number(ann.width.toFixed(2)),
          height: Number(ann.height.toFixed(2)),
        },
      };
    }

    if (ann.type === "polygon") {
      return {
        ...baseAnnotation,
        coordinates: {
          units: "pixels",
          points: ann.points.map((pt) => Number(pt.toFixed(2))),
        },
      };
    }

    if (ann.type === "mask") {
      return {
        ...baseAnnotation,
        coordinates: {
          units: "pixels",
          strokes: ann.strokes.map((stroke) => ({
            mode: stroke.mode,
            size: stroke.size,
            points: stroke.points.map((pt) => Number(pt.toFixed(2))),
          })),
        },
      };
    }

    return baseAnnotation;
  };

  const handleExportJSON = () => {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        canvasDimensions: {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
        },
        totalImages: images.length,
        totalLabels: labels.length,
        totalAnnotations: annotations.length,
      },
      labels: labels.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      images: images.map((image) => {
        const imageAnnotations = annotations
          .filter((ann) => ann.imageId === image.id)
          .map((ann) => formatAnnotationForExport(ann));

        return {
          id: image.id,
          fileName: image.name,
          imageDimensions: {
            width: loadedImage ? loadedImage.width : null,
            height: loadedImage ? loadedImage.height : null,
          },
          annotations: imageAnnotations,
        };
      }),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `dataset_annotations_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // =========================
  // Render Helpers
  // =========================

  const renderBoxHandles = (annotation) => {
    if (activeTool !== "select" || selectedAnnotationId !== annotation.id) {
      return null;
    }

    const x = imageX + annotation.x * fitScale;
    const y = imageY + annotation.y * fitScale;
    const width = annotation.width * fitScale;
    const height = annotation.height * fitScale;
    const handleSize = 8 / zoomScale;

    const handles = [
      { name: "top-left", x, y },
      { name: "top", x: x + width / 2, y },
      { name: "top-right", x: x + width, y },
      { name: "left", x, y: y + height / 2 },
      { name: "right", x: x + width, y: y + height / 2 },
      { name: "bottom-left", x, y: y + height },
      { name: "bottom", x: x + width / 2, y: y + height },
      { name: "bottom-right", x: x + width, y: y + height },
    ];

    return handles.map((handle) => (
      <Rect
        key={handle.name}
        x={handle.x - handleSize / 2}
        y={handle.y - handleSize / 2}
        width={handleSize}
        height={handleSize}
        fill="white"
        stroke="blue"
        strokeWidth={1 / zoomScale}
        onMouseDown={(event) => startBoxResize(annotation, handle.name, event)}
      />
    ));
  };

  const renderAnnotation = (annotation) => {
    if (annotation.type === "mask") return null;

    const isSelected = annotation.id === selectedAnnotationId;
    const isHovered = annotation.id === hoveredAnnotationId;
    const assignedLabel = labels.find(
      (label) => label.id === annotation.labelId
    );
    const annotationColor = assignedLabel?.color || "red";

    if (annotation.type === "bbox") {
      return (
        <Group
          key={annotation.id}
          draggable={activeTool === "select"}
          onDragEnd={(event) => handleAnnotationDragEnd(annotation.id, event)}
          onMouseDown={(event) =>
            handleAnnotationSelect(annotation.id, event)
          }
          onMouseEnter={() => handleAnnotationHover(annotation.id)}
          onMouseLeave={handleAnnotationLeave}
        >
          <Rect
            x={imageX + annotation.x * fitScale}
            y={imageY + annotation.y * fitScale}
            width={annotation.width * fitScale}
            height={annotation.height * fitScale}
            stroke={isSelected ? "blue" : annotationColor}
            strokeWidth={isSelected ? 3 / zoomScale : 2 / zoomScale}
            fill={
              isSelected ? "rgba(0,0,255,0.08)" : "rgba(255,0,0,0.05)"
            }
          />

          {assignedLabel && isHovered && (
            <Text
              x={imageX + annotation.x * fitScale}
              y={imageY + annotation.y * fitScale - 20 / zoomScale}
              text={assignedLabel.name}
              fontSize={16 / zoomScale}
              fill={assignedLabel.color}
              listening={false}
            />
          )}

          {renderBoxHandles(annotation)}
        </Group>
      );
    }

    if (annotation.type === "polygon") {
      const scaledPoints = annotation.points.map((point, index) =>
        index % 2 === 0 ? imageX + point * fitScale : imageY + point * fitScale
      );

      return (
        <Group
          key={annotation.id}
          draggable={activeTool === "select"}
          onDragEnd={(event) => handleAnnotationDragEnd(annotation.id, event)}
          onMouseDown={(event) =>
            handleAnnotationSelect(annotation.id, event)
          }
          onMouseEnter={() => handleAnnotationHover(annotation.id)}
          onMouseLeave={handleAnnotationLeave}
        >
          <Line
            points={scaledPoints}
            closed
            stroke={isSelected ? "blue" : annotationColor}
            strokeWidth={isSelected ? 3 / zoomScale : 2 / zoomScale}
            fill={
              isSelected ? "rgba(0,0,255,0.08)" : "rgba(255,0,0,0.05)"
            }
          />

          {assignedLabel && isHovered && (
            <Text
              x={scaledPoints[0]}
              y={scaledPoints[1] - 20 / zoomScale}
              text={assignedLabel.name}
              fontSize={16 / zoomScale}
              fill={assignedLabel.color}
              listening={false}
            />
          )}

          {isSelected &&
            annotation.points
              .reduce((points, value, index) => {
                if (index % 2 === 0) {
                  points.push({
                    x: imageX + value * fitScale,
                    y: imageY + annotation.points[index + 1] * fitScale,
                  });
                }
                return points;
              }, [])
              .map((point, index) => (
                <Circle
                  key={index}
                  x={point.x}
                  y={point.y}
                  radius={6 / zoomScale}
                  fill="white"
                  stroke="blue"
                  strokeWidth={2 / zoomScale}
                  draggable={activeTool === "select"}
                  onDragMove={(event) =>
                    handlePolygonPointDrag(annotation.id, index, event)
                  }
                  onDragEnd={handlePolygonPointDragEnd}
                />
              ))}
        </Group>
      );
    }

    return null;
  };

  const renderMaskAnnotation = (annotation) => {
    if (annotation.type !== "mask") return null;

    const isSelected = annotation.id === selectedAnnotationId;
    const isHovered = annotation.id === hoveredAnnotationId;
    const assignedLabel = labels.find(
      (label) => label.id === annotation.labelId
    );
    const annotationColor = assignedLabel?.color || "red";

    const firstDrawStroke = annotation.strokes?.find(
      (stroke) => stroke.mode === "draw"
    );
    const firstPoint = firstDrawStroke?.points || [0, 0];
    const labelX = imageX + firstPoint[0] * fitScale;
    const labelY = imageY + firstPoint[1] * fitScale;

    return (
      <Group
        key={annotation.id}
        draggable={activeTool === "select"}
        onDragEnd={(event) => handleAnnotationDragEnd(annotation.id, event)}
        onMouseDown={(event) => handleAnnotationSelect(annotation.id, event)}
        onMouseEnter={() => handleAnnotationHover(annotation.id)}
        onMouseLeave={handleAnnotationLeave}
      >
        {annotation.strokes?.map((stroke, index) => {
          const scaledPoints = stroke.points.map((point, pointIndex) =>
            pointIndex % 2 === 0
              ? imageX + point * fitScale
              : imageY + point * fitScale
          );

          return (
            <Line
              key={index}
              points={scaledPoints}
              stroke={stroke.mode === "erase" ? "black" : annotationColor}
              strokeWidth={stroke.size * fitScale}
              lineCap="round"
              lineJoin="round"
              opacity={
                stroke.mode === "erase" ? 1 : isSelected ? 0.65 : 0.45
              }
              globalCompositeOperation={
                stroke.mode === "erase" ? "destination-out" : "source-over"
              }
              hitStrokeWidth={Math.max(stroke.size * fitScale, 15)}
            />
          );
        })}

        {assignedLabel && isHovered && (
          <Text
            x={labelX}
            y={labelY - 20 / zoomScale}
            text={assignedLabel.name}
            fontSize={16 / zoomScale}
            fill={assignedLabel.color}
            listening={false}
          />
        )}
      </Group>
    );
  };

  // =========================
  // Main Layout Render
  // =========================

  return (
    <div className="app">
      {/* Toolbar */}
      <div className="toolbar">
        <label className="import-button">
          Import Images
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageImport}
            hidden
          />
        </label>

        <button onClick={handlePreviousImage} disabled={currentImageIndex <= 0}>
          Previous
        </button>

        <button
          onClick={handleNextImage}
          disabled={
            currentImageIndex === -1 || currentImageIndex >= images.length - 1
          }
        >
          Next
        </button>

        <div className="selected-label-control">
          <label>Label:</label>
          <select
            value={selectedLabelId}
            onChange={(event) => {
              setSelectedLabelId(event.target.value);
              resetDrawingState();
              setActiveTool("select");
            }}
          >
            <option value="">Select Label</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className={
            activeTool === "select" ? "tool-button active" : "tool-button"
          }
          onClick={() => activateTool("select")}
        >
          Select / Edit
        </button>

        <button
          className={
            activeTool === "bbox" ? "tool-button active" : "tool-button"
          }
          onClick={() => activateTool("bbox")}
          disabled={labels.length === 0 || !selectedLabelId}
        >
          Bounding Box
        </button>

        <button
          className={
            activeTool === "polygon" ? "tool-button active" : "tool-button"
          }
          onClick={() => activateTool("polygon")}
          disabled={labels.length === 0 || !selectedLabelId}
        >
          Polygon
        </button>

        <button
          className={
            activeTool === "mask" ? "tool-button active" : "tool-button"
          }
          onClick={() => activateTool("mask")}
          disabled={labels.length === 0 || !selectedLabelId || maskBrushSize === 0}
        >
          Mask
        </button>

        <button
          className={
            activeTool === "mask-erase" ? "tool-button active" : "tool-button"
          }
          onClick={() => activateTool("mask-erase")}
          disabled={labels.length === 0 || !selectedLabelId || maskBrushSize === 0}
        >
          Mask Erase
        </button>

        {activeTool === "polygon" && polygonPoints.length >= 6 && (
          <button onClick={finishPolygon}>Finish Polygon</button>
        )}

        {(activeTool === "mask" || activeTool === "mask-erase") && (
          <div className="brush-size-control">
            <label>Brush Size:</label>
            <select
              value={maskBrushSize}
              onChange={(event) =>
                setMaskBrushSize(Number(event.target.value))
              }
            >
              {Array.from({ length: 21 }, (_, index) => index * 5).map(
                (size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                )
              )}
            </select>
          </div>
        )}

        <button
          onClick={() => handleDeleteAnnotationById(selectedAnnotationId)}
          disabled={!selectedAnnotationId}
        >
          Delete
        </button>

        <button onClick={handleUndo} disabled={historyIndex < 0}>
          Undo
        </button>

        <button onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
          Redo
        </button>

        <label className="zoom-control">
          Zoom:
          <select
            value={zoomPercent}
            onChange={(event) => setZoomPercent(Number(event.target.value))}
          >
            {zoomOptions.map((zoom) => (
              <option key={zoom} value={zoom}>
                {zoom}%
              </option>
            ))}
          </select>
        </label>

        <button onClick={resetView}>Reset View</button>

        <button
          className="export-button"
          onClick={handleExportJSON}
          disabled={images.length === 0}
        >
          Export JSON
        </button>
      </div>

      {/* Main Workspace */}
      <div className="workspace">
        <div className="image-list">
          <div className="image-list-header">Images ({images.length})</div>
          <div className="image-list-items">
            {images.map((image) => (
              <div
                key={image.id}
                className={`image-item ${
                  image.id === currentImageId ? "selected" : ""
                }`}
                onClick={() => handleImageSelect(image.id)}
              >
                <img src={image.src} alt={image.name} className="thumbnail" />
                <span className="image-name">{image.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-container">
          <div className="canvas-wrapper">
            <Stage
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onDblClick={() => {
                if (activeTool === "polygon") {
                  finishPolygon();
                }
              }}
            >
              <Layer
                x={layerX}
                y={layerY}
                scaleX={zoomScale}
                scaleY={zoomScale}
                draggable={isPannableTool && zoomPercent > 0}
                onDragMove={handlePanMove}
              >
                {loadedImage && (
                  <KonvaImage
                    image={loadedImage}
                    x={imageX}
                    y={imageY}
                    width={displayWidth}
                    height={displayHeight}
                  />
                )}
              </Layer>

              <Layer
                x={layerX}
                y={layerY}
                scaleX={zoomScale}
                scaleY={zoomScale}
                onMouseMove={resizingBox ? handleBoxResizeMove : undefined}
                onMouseUp={resizingBox ? finishBoxResize : undefined}
              >
                {currentAnnotations.map(renderAnnotation)}

                {draftBox && (
                  <Rect
                    x={imageX + draftBox.x * fitScale}
                    y={imageY + draftBox.y * fitScale}
                    width={draftBox.width * fitScale}
                    height={draftBox.height * fitScale}
                    stroke="blue"
                    strokeWidth={2 / zoomScale}
                    dash={[6 / zoomScale, 4 / zoomScale]}
                    listening={false}
                  />
                )}

                {polygonPoints.length >= 2 && (
                  <Line
                    points={polygonPoints.map((point, index) =>
                      index % 2 === 0
                        ? imageX + point * fitScale
                        : imageY + point * fitScale
                    )}
                    stroke="blue"
                    strokeWidth={2 / zoomScale}
                    dash={[6 / zoomScale, 4 / zoomScale]}
                    closed={false}
                    listening={false}
                  />
                )}

                {polygonPoints
                  .reduce((points, value, index) => {
                    if (index % 2 === 0) {
                      points.push({
                        x: imageX + value * fitScale,
                        y: imageY + polygonPoints[index + 1] * fitScale,
                      });
                    }
                    return points;
                  }, [])
                  .map((point, index) => (
                    <Circle
                      key={index}
                      x={point.x}
                      y={point.y}
                      radius={4 / zoomScale}
                      fill="blue"
                      listening={false}
                    />
                  ))}
              </Layer>

              <Layer x={layerX} y={layerY} scaleX={zoomScale} scaleY={zoomScale}>
                {currentAnnotations
                  .filter((annotation) => annotation.type === "mask")
                  .map(renderMaskAnnotation)}

                {currentMaskStroke && (
                  <Line
                    points={currentMaskStroke.points.map((point, index) =>
                      index % 2 === 0
                        ? imageX + point * fitScale
                        : imageY + point * fitScale
                    )}
                    stroke={
                      currentMaskStroke.mode === "erase"
                        ? "black"
                        : labels.find((label) => label.id === selectedLabelId)
                            ?.color || "red"
                    }
                    strokeWidth={currentMaskStroke.size * fitScale}
                    lineCap="round"
                    lineJoin="round"
                    opacity={currentMaskStroke.mode === "erase" ? 1 : 0.5}
                    globalCompositeOperation={
                      currentMaskStroke.mode === "erase"
                        ? "destination-out"
                        : "source-over"
                    }
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Right Split Panel */}
        <div className="label-panel">
          {/* Labels Section */}
          <div className="label-section">
            <div className="label-panel-header">Labels</div>

            <div className="label-create">
              <input
                type="text"
                value={newLabelName}
                onChange={(event) => setNewLabelName(event.target.value)}
                placeholder="Label name"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleCreateLabel();
                  }
                }}
              />

              <div className="label-create-row">
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(event) => setNewLabelColor(event.target.value)}
                />
                <button onClick={handleCreateLabel}>Add Label</button>
              </div>
            </div>

            <div className="label-list">
              {labels.length === 0 && (
                <div className="no-labels">No labels created.</div>
              )}

              {labels.map((label) => (
                <div
                  key={label.id}
                  className={`label-item ${
                    selectedLabelId === label.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedLabelId(label.id)}
                >
                  <span
                    className="label-color"
                    style={{ backgroundColor: label.color }}
                  />

                  {editingLabelId === label.id ? (
                    <input
                      className="label-edit-input"
                      value={editingLabelName}
                      onChange={(event) =>
                        setEditingLabelName(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveRenameLabel();
                        }
                        if (event.key === "Escape") {
                          setEditingLabelId(null);
                          setEditingLabelName("");
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="label-name">{label.name}</span>
                  )}

                  {editingLabelId === label.id ? (
                    <button onClick={saveRenameLabel}>Save</button>
                  ) : (
                    <button onClick={() => startRenameLabel(label)}>
                      Rename
                    </button>
                  )}

                  <button onClick={() => handleDeleteLabel(label.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Annotations Section */}
          <div className="annotation-section">
            <div className="label-panel-header">
              Annotations ({currentAnnotations.length})
            </div>

            <div className="annotation-list">
              {currentAnnotations.length === 0 && (
                <div className="no-labels">No annotations on this image.</div>
              )}

              {currentAnnotations.map((ann) => {
                const assignedLabel = labels.find(
                  (l) => l.id === ann.labelId
                );

                return (
                  <div
                    key={ann.id}
                    className={`annotation-item ${
                      selectedAnnotationId === ann.id ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedAnnotationId(ann.id);
                      setActiveTool("select");
                    }}
                  >
                    <span
                      className="label-color"
                      style={{
                        backgroundColor: assignedLabel?.color || "#999",
                      }}
                    />

                    <div className="annotation-info">
                      <span className="annotation-name">
                        {assignedLabel?.name || "Unlabeled"}
                      </span>
                      <span className="annotation-type">
                        {ann.type.toUpperCase()}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingAnnotation(ann);
                      }}
                    >
                      Info
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAnnotationById(ann.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Pop-up Modal with Attribute Editor */}
      {inspectingAnnotation && (
        <div
          className="modal-overlay"
          onClick={() => setInspectingAnnotation(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Annotation Details & Attributes</h3>

            {/* Add Attribute Controls */}
            <div className="attribute-create">
              <input
                type="text"
                placeholder="Key (e.g., occluded)"
                value={attributeKey}
                onChange={(e) => setAttributeKey(e.target.value)}
              />
              <input
                type="text"
                placeholder="Value (e.g., true)"
                value={attributeValue}
                onChange={(e) => setAttributeValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddAttribute(inspectingAnnotation.id);
                  }
                }}
              />
              <button
                onClick={() => handleAddAttribute(inspectingAnnotation.id)}
              >
                Add Key/Value
              </button>
            </div>

            {/* List Active Attributes */}
            <div className="attribute-list">
              <strong>Active Attributes:</strong>
              {Object.keys(inspectingAnnotation.attributes || {}).length === 0 ? (
                <div className="no-attributes">
                  No custom attributes assigned.
                </div>
              ) : (
                Object.entries(inspectingAnnotation.attributes).map(
                  ([key, val]) => (
                    <div key={key} className="attribute-chip">
                      <span>
                        <strong>{key}:</strong> {String(val)}
                      </span>
                      <button
                        onClick={() =>
                          handleRemoveAttribute(inspectingAnnotation.id, key)
                        }
                      >
                        ✕
                      </button>
                    </div>
                  )
                )
              )}
            </div>

            {/* Structured Preview */}
            <div className="modal-body">
              <pre>
                {JSON.stringify(
                  formatAnnotationForExport(inspectingAnnotation),
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="modal-actions">
              <button onClick={() => setInspectingAnnotation(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;