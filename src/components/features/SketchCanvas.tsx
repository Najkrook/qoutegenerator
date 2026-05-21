import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { DOOR_LABEL, MIN_DIMENSION_MM, STEP_MM } from '../../utils/sectionCalculator';
import {
    getFiestaRadiusMm,
    getEffectiveParasolDimensions,
    getParasolRotationDeg,
    isParasolRotatable,
    PARASOL_PRESETS,
    groupParasolPresetsByCategory
} from '../../utils/parasolGeometry';
import type {
    EdgeSummary,
    PlacedFiesta,
    PlacedParasol,
    SketchCamera,
    SketchCanvasProps,
    SketchEdgeKey,
    SketchConfigState,
    SketchRenderedSegment,
    SketchSectionEntry
} from '../../types/contracts';

type ActiveDrag = 'front' | 'right' | 'left' | 'depthLeft' | 'depthRight';
type EdgeDirection = 'E' | 'S';

interface ResizeDragState {
    startX: number;
    startY: number;
    initialW: number;
    initialD: number;
    initialDLeft: number;
    initialDRight: number;
}

interface DraggedItemState {
    id: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
}

interface PanState {
    startX: number;
    startY: number;
    panX: number;
    panY: number;
}

interface TouchPinchState {
    distance: number;
    camera: SketchCamera;
    centerX: number;
    centerY: number;
}

interface TouchSinglePanState {
    startX: number;
    startY: number;
    camera: SketchCamera;
}

interface SegmentGeometry {
    x: number;
    y: number;
    w: number;
    h: number;
    tx: number;
    ty: number;
}

interface DragHandleProps {
    x: number;
    y: number;
    edgeId: ActiveDrag;
    cursor: string;
}

const DEFAULT_CAMERA: SketchCamera = { zoom: 1, panX: 0, panY: 0 };
const EDGE_LABELS: Record<SketchEdgeKey, string> = {
    front: 'Fram',
    left: 'Vänster',
    right: 'Höger',
    back: 'Bak'
};
const MODE_HELP_TEXT: Record<NonNullable<SketchCanvasProps['activeMode']>, string> = {
    clickitup: 'Klicka på en sektion för att redigera den, eller på en stolpe i kanten för kantens verktyg i inspektören.',
    parasol: 'Välj modell i inspektören och klicka sedan i ytan för att placera parasollet.',
    fiesta: 'Klicka i ytan för att placera Fiesta och markera den sedan för att justera eller ta bort.'
};

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function parseDoorSize(item: SketchSectionEntry): number | null {
    const match = new RegExp(`${DOOR_LABEL}\\s+(\\d+)`, 'i').exec(String(item));
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function snapToGrid(value: number): number {
    return Math.round(value / STEP_MM) * STEP_MM;
}

function normalizeCamera(camera: Partial<SketchCamera> | undefined, width: number, depth: number, padding: number): SketchCamera {
    const zoom = clamp(Number(camera?.zoom) || 1, 0.55, 3.5);
    const totalWidth = width + padding * 2;
    const totalHeight = depth + padding * 2;

    const viewWidth = totalWidth / zoom;
    const viewHeight = totalHeight / zoom;

    const minX = -padding;
    const minY = -padding;
    const maxX = width + padding - viewWidth;
    const maxY = depth + padding - viewHeight;

    const panX = maxX < minX ? (maxX + minX) / 2 : clamp(Number(camera?.panX) || 0, minX, maxX);
    const panY = maxY < minY ? (maxY + minY) / 2 : clamp(Number(camera?.panY) || 0, minY, maxY);

    return { zoom, panX, panY };
}

function sectionSegmentsFromArray(sections: SketchSectionEntry[], edgeKey: SketchEdgeKey): SketchRenderedSegment[] {
    return sections.map((item, index) => {
        const doorSize = parseDoorSize(item);
        const isDoor = doorSize !== null;
        const length = isDoor ? doorSize : Number(item);

        return {
            index,
            key: `${edgeKey}-${index}-${item}`,
            type: isDoor ? 'door' : 'section',
            length,
            isDoor,
            label: isDoor ? `${DOOR_LABEL} ${doorSize}` : `${length}`
        };
    });
}

export function SketchCanvas({
    width,
    depth,
    depthLeft: propDepthLeft,
    depthRight: propDepthRight,
    equalDepth = true,
    includeBack,
    leftEdge,
    rightEdge,
    frontEdge,
    backEdge,
    edgeDiagnostics = {},
    edgeSummaries = {},
    camera = DEFAULT_CAMERA,
    selection,
    uiDensity = 'desktop',
    activeMode = 'clickitup',
    parasols = [],
    selectedParasolId = null,
    fiestaItems = [],
    selectedFiestaId = null,
    hoverPreviewLayout,
    onHoverSuggestion,
    undo,
    redo,
    canUndo = false,
    canRedo = false,
    onResize,
    onResizePreview,
    onResizeCommit,
    onSelectEdge,
    onSelectSection,
    onCameraChange,
    onChangeMode,
    onPlaceParasol,
    onSelectParasol,
    onMoveParasol,
    onRotateParasol,
    onDeleteParasol,
    onChangeParasolPreset,
    onPlaceFiesta,
    onSelectFiesta,
    onMoveFiesta,
    manualSectionsByEdge = {},
    doorSegmentsByEdge = {},
    onSetManualPin,
    onClearManualPins,
    onSetDoorSegmentSize,
    onResetDoorSegment,
}: SketchCanvasProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    const dragRef = useRef<ResizeDragState>({ startX: 0, startY: 0, initialW: 0, initialD: 0, initialDLeft: 0, initialDRight: 0 });
    const [snapLines, setSnapLines] = useState<{ x: number | null, y: number | null } | null>(null);

    const [activeEditingDim, setActiveEditingDim] = useState<'width' | 'depthLeft' | 'depthRight' | null>(null);
    const [dimInputValue, setDimInputValue] = useState<string>('');

    const handleCommitDim = useCallback((dimKey: 'width' | 'depthLeft' | 'depthRight', rawValue: string) => {
        setActiveEditingDim(null);
        const val = parseFloat(rawValue);
        if (!isNaN(val) && val >= 0) {
            const snapped = snapToGrid(val);
            const clampedVal = dimKey === 'width' ? Math.max(MIN_DIMENSION_MM, snapped) : snapped;
            
            if (dimKey === 'width') {
                onResizeCommit?.({ width: clampedVal });
            } else if (dimKey === 'depthLeft') {
                if (equalDepth) {
                    onResizeCommit?.({ depth: clampedVal, depthLeft: clampedVal, depthRight: clampedVal });
                } else {
                    onResizeCommit?.({ depthLeft: clampedVal });
                }
            } else if (dimKey === 'depthRight') {
                if (equalDepth) {
                    onResizeCommit?.({ depth: clampedVal, depthLeft: clampedVal, depthRight: clampedVal });
                } else {
                    onResizeCommit?.({ depthRight: clampedVal });
                }
            }
        }
    }, [equalDepth, onResizeCommit]);

    const [dragWidth, setDragWidth] = useState<number | null>(null);
    const [dragDepth, setDragDepth] = useState<number | null>(null);
    const [dragDepthLeft, setDragDepthLeft] = useState<number | null>(null);
    const [dragDepthRight, setDragDepthRight] = useState<number | null>(null);
    const dragWidthRef = useRef<number | null>(null);
    const dragDepthRef = useRef<number | null>(null);
    const dragDepthLeftRef = useRef<number | null>(null);
    const dragDepthRightRef = useRef<number | null>(null);
    const panRef = useRef<PanState | null>(null);
    const touchRef = useRef<{
        pinch: TouchPinchState | null;
        singlePan: TouchSinglePanState | null;
    }>({ pinch: null, singlePan: null });

    const currentWidth = dragWidth ?? width;
    const currentDepthLeft = dragDepthLeft ?? (equalDepth ? (dragDepth ?? propDepthLeft ?? depth) : (propDepthLeft ?? depth));
    const currentDepthRight = dragDepthRight ?? (equalDepth ? (dragDepth ?? propDepthRight ?? depth) : (propDepthRight ?? depth));
    const currentMaxDepth = Math.max(currentDepthLeft, currentDepthRight);

    const isPointInBoundary = useCallback((x: number, y: number) => {
        if (x < 0 || x > currentWidth) return false;
        const t = x / currentWidth;
        const yTop = (currentMaxDepth - currentDepthLeft) * (1 - t) + (currentMaxDepth - currentDepthRight) * t;
        const yBottom = currentMaxDepth;
        return y >= yTop && y <= yBottom;
    }, [currentWidth, currentMaxDepth, currentDepthLeft, currentDepthRight]);

    const isParasolInBoundary = useCallback((px: number, py: number, w: number, d: number) => {
        return (
            isPointInBoundary(px - w / 2, py - d / 2) &&
            isPointInBoundary(px + w / 2, py - d / 2) &&
            isPointInBoundary(px - w / 2, py + d / 2) &&
            isPointInBoundary(px + w / 2, py + d / 2)
        );
    }, [isPointInBoundary]);

    const isFiestaInBoundary = useCallback((fx: number, fy: number, r: number) => {
        return (
            isPointInBoundary(fx - r, fy) &&
            isPointInBoundary(fx + r, fy) &&
            isPointInBoundary(fx, fy - r) &&
            isPointInBoundary(fx, fy + r)
        );
    }, [isPointInBoundary]);

    const hasCollision = useCallback((itemId: string, type: 'parasol' | 'fiesta') => {
        if (type === 'parasol') {
            const p = parasols.find(item => item.id === itemId);
            if (!p) return false;
            const dims = getEffectiveParasolDimensions(p);
            if (!isParasolInBoundary(p.xMm, p.yMm, dims.widthMm, dims.depthMm)) return true;
            for (const other of parasols) {
                if (other.id === itemId) continue;
                const oDims = getEffectiveParasolDimensions(other);
                const rect1 = { left: p.xMm - dims.widthMm / 2, right: p.xMm + dims.widthMm / 2, top: p.yMm - dims.depthMm / 2, bottom: p.yMm + dims.depthMm / 2 };
                const rect2 = { left: other.xMm - oDims.widthMm / 2, right: other.xMm + oDims.widthMm / 2, top: other.yMm - oDims.depthMm / 2, bottom: other.yMm + oDims.depthMm / 2 };
                const overlap = !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
                if (overlap) return true;
            }
        } else {
            const f = fiestaItems.find(item => item.id === itemId);
            if (!f) return false;
            const r = getFiestaRadiusMm(f);
            if (!isFiestaInBoundary(f.xMm, f.yMm, r)) return true;
            for (const other of fiestaItems) {
                if (other.id === itemId) continue;
                const or = getFiestaRadiusMm(other);
                const dx = f.xMm - other.xMm;
                const dy = f.yMm - other.yMm;
                if ((dx * dx + dy * dy) < (r + or) * (r + or)) return true;
            }
        }
        return false;
    }, [parasols, fiestaItems, isParasolInBoundary, isFiestaInBoundary]);

    const isShowingPreview = useMemo(() => {
        if (!hoverPreviewLayout) return false;
        if (hoverPreviewLayout.width !== width) return true;
        if (hoverPreviewLayout.depthLeft !== (propDepthLeft ?? depth)) return true;
        if (hoverPreviewLayout.depthRight !== (propDepthRight ?? depth)) return true;
        
        const edges: SketchEdgeKey[] = ['front', 'left', 'right', 'back'];
        for (const edge of edges) {
            const currentEdge = edge === 'front' ? frontEdge : edge === 'left' ? leftEdge : edge === 'right' ? rightEdge : backEdge;
            const previewEdge = hoverPreviewLayout[`${edge}Edge` as const] || [];
            if (currentEdge.length !== previewEdge.length) return true;
            for (let i = 0; i < currentEdge.length; i++) {
                if (String(currentEdge[i]) !== String(previewEdge[i])) return true;
            }
        }
        return false;
    }, [hoverPreviewLayout, width, depth, propDepthLeft, propDepthRight, frontEdge, leftEdge, rightEdge, backEdge]);

    const padding = uiDensity === 'touch' ? 2000 : 1500;
    const activeCamera = useMemo(
        () => normalizeCamera(camera, currentWidth, currentMaxDepth, padding),
        [camera, currentWidth, currentMaxDepth, padding]
    );

    const totalWidth = currentWidth + padding * 2;
    const totalHeight = currentMaxDepth + padding * 2;
    const viewWidth = totalWidth / activeCamera.zoom;
    const viewHeight = totalHeight / activeCamera.zoom;
    const viewBox = `${activeCamera.panX} ${activeCamera.panY} ${viewWidth} ${viewHeight}`;

    const handleSize = uiDensity === 'touch' ? 150 : 110;
    const handleHit = uiDensity === 'touch' ? 600 : 420;
    const sectionThickness = uiDensity === 'touch' ? 130 : 100;
    const labelFont = uiDensity === 'touch' ? 220 : 190;

    const summaryByEdge = useMemo<Record<SketchEdgeKey, Partial<EdgeSummary> & { segments: SketchRenderedSegment[] }>>(
        () => ({
            front: edgeSummaries.front || {
                segments: sectionSegmentsFromArray(frontEdge, 'front'),
                enabled: true,
                effectiveLength: currentWidth
            },
            left: edgeSummaries.left || {
                segments: sectionSegmentsFromArray(leftEdge, 'left'),
                enabled: true,
                effectiveLength: currentDepthLeft
            },
            right: edgeSummaries.right || {
                segments: sectionSegmentsFromArray(rightEdge, 'right'),
                enabled: true,
                effectiveLength: currentDepthRight
            },
            back: edgeSummaries.back || {
                segments: sectionSegmentsFromArray(backEdge, 'back'),
                enabled: includeBack,
                effectiveLength: currentWidth
            }
        }),
        [backEdge, currentDepthLeft, currentDepthRight, currentWidth, edgeSummaries, frontEdge, includeBack, leftEdge, rightEdge]
    );

    const selectedEdge = selection?.edgeKey || null;
    const activeSelectionLabel = useMemo(() => {
        if (activeMode === 'parasol') {
            return selectedParasolId ? 'Markerat parasoll' : 'Ingen markerad parasoll';
        }
        if (activeMode === 'fiesta') {
            return selectedFiestaId ? 'Markerad Fiesta' : 'Ingen markerad Fiesta';
        }
        if (!selectedEdge) {
            return 'Ingen markerad kant';
        }
        const edgeLabel = EDGE_LABELS[selectedEdge] || selectedEdge;
        if (selection?.segmentIndex === null || selection?.segmentIndex === undefined) {
            return `Vald kant: ${edgeLabel}`;
        }
        return `${edgeLabel} · segment ${selection.segmentIndex + 1}`;
    }, [activeMode, selectedEdge, selectedFiestaId, selectedParasolId, selection?.segmentIndex]);

    const selectedSegmentToolbarInfo = useMemo(() => {
        if (!selectedEdge || selection?.segmentIndex === null || selection?.segmentIndex === undefined) {
            return null;
        }

        const summary = summaryByEdge[selectedEdge];
        if (!summary || summary.enabled === false) {
            return null;
        }

        const segments = summary.segments || [];
        const segmentIndex = selection.segmentIndex;
        if (segmentIndex < 0 || segmentIndex >= segments.length) {
            return null;
        }

        let startX = 0;
        let startY = 0;
        let direction: 'E' | 'S' = 'E';

        if (selectedEdge === 'front') {
            startX = 0;
            startY = currentMaxDepth;
            direction = 'E';
        } else if (selectedEdge === 'left') {
            startX = 0;
            startY = currentMaxDepth - currentDepthLeft;
            direction = 'S';
        } else if (selectedEdge === 'right') {
            startX = currentWidth;
            startY = currentMaxDepth - currentDepthRight;
            direction = 'S';
        } else if (selectedEdge === 'back') {
            startX = 0;
            startY = 0;
            direction = 'E';
        }

        let cx = startX;
        let cy = startY;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const len = Number(segment.length) || 0;

            if (i === segmentIndex) {
                const geometry = direction === 'E'
                    ? {
                        x: cx,
                        y: cy - sectionThickness / 2,
                        w: len,
                        h: sectionThickness,
                        tx: cx + len / 2,
                        ty: cy + sectionThickness + 210
                    }
                    : {
                        x: cx - sectionThickness / 2,
                        y: cy,
                        w: sectionThickness,
                        h: len,
                        tx: cx - sectionThickness - 260,
                        ty: cy + len / 2
                    };

                return {
                    edgeKey: selectedEdge,
                    segment,
                    geometry,
                    direction
                };
            }

            if (direction === 'E') {
                cx += len;
            } else {
                cy += len;
            }
        }

        return null;
    }, [selectedEdge, selection?.segmentIndex, summaryByEdge, currentMaxDepth, currentDepthLeft, currentDepthRight, currentWidth, sectionThickness]);

    const emitCamera = useCallback(
        (nextCamera) => {
            const normalized = normalizeCamera(nextCamera, currentWidth, currentMaxDepth, padding);
            onCameraChange?.(normalized);
        },
        [onCameraChange, currentWidth, currentMaxDepth, padding]
    );

    const handleWheel = useCallback(
        (event) => {
            event.preventDefault();
            const svg = svgRef.current;
            if (!svg) return;

            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const pointerX = (event.clientX - rect.left) / rect.width;
            const pointerY = (event.clientY - rect.top) / rect.height;

            const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
            const nextZoom = clamp(activeCamera.zoom * zoomFactor, 0.55, 3.5);

            const prevViewWidth = totalWidth / activeCamera.zoom;
            const prevViewHeight = totalHeight / activeCamera.zoom;
            const worldX = activeCamera.panX + pointerX * prevViewWidth;
            const worldY = activeCamera.panY + pointerY * prevViewHeight;

            const nextViewWidth = totalWidth / nextZoom;
            const nextViewHeight = totalHeight / nextZoom;
            const nextPanX = worldX - pointerX * nextViewWidth;
            const nextPanY = worldY - pointerY * nextViewHeight;

            emitCamera({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
        },
        [activeCamera, emitCamera, totalWidth, totalHeight]
    );

    const setCenteredZoom = useCallback((targetZoom) => {
        const nextZoom = clamp(targetZoom, 0.55, 3.5);
        const centerX = activeCamera.panX + viewWidth / 2;
        const centerY = activeCamera.panY + viewHeight / 2;
        const nextViewWidth = totalWidth / nextZoom;
        const nextViewHeight = totalHeight / nextZoom;

        emitCamera({
            zoom: nextZoom,
            panX: centerX - nextViewWidth / 2,
            panY: centerY - nextViewHeight / 2
        });
    }, [activeCamera.panX, activeCamera.panY, emitCamera, totalHeight, totalWidth, viewHeight, viewWidth]);

    const handleZoomIn = useCallback(() => {
        setCenteredZoom(activeCamera.zoom * 1.15);
    }, [activeCamera.zoom, setCenteredZoom]);

    const handleZoomOut = useCallback(() => {
        setCenteredZoom(activeCamera.zoom / 1.15);
    }, [activeCamera.zoom, setCenteredZoom]);

    const handleFitView = useCallback(() => {
        emitCamera(DEFAULT_CAMERA);
    }, [emitCamera]);

    const beginResize = useCallback(
        (edgeId, event) => {
            event.preventDefault();
            event.stopPropagation();
            dragRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                initialW: width,
                initialD: depth, // This is the original shared depth prop
                initialDLeft: propDepthLeft ?? depth,
                initialDRight: propDepthRight ?? depth
            };
            setActiveDrag(edgeId);
        },
        [depth, width, propDepthLeft, propDepthRight]
    );

    useEffect(() => {
        if (!activeDrag) return undefined;

        const handleMove = (event) => {
            const svg = svgRef.current;
            if (!svg) return;

            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const worldPerPixelX = viewWidth / rect.width;
            const worldPerPixelY = viewHeight / rect.height;
            const deltaX = (event.clientX - dragRef.current.startX) * worldPerPixelX;
            const deltaY = (event.clientY - dragRef.current.startY) * worldPerPixelY;

            if (activeDrag === 'front') {
                if (equalDepth) {
                    const newDepth = Math.max(0, snapToGrid(dragRef.current.initialD + deltaY));
                    dragDepthRef.current = newDepth;
                    dragDepthLeftRef.current = newDepth;
                    dragDepthRightRef.current = newDepth;
                    setDragDepth(newDepth);
                    setDragDepthLeft(newDepth);
                    setDragDepthRight(newDepth);
                    onResizePreview?.({ depth: newDepth, depthLeft: newDepth, depthRight: newDepth });
                } else {
                    const nextLeft = Math.max(0, snapToGrid(dragRef.current.initialDLeft + deltaY));
                    const nextRight = Math.max(0, snapToGrid(dragRef.current.initialDRight + deltaY));
                    dragDepthLeftRef.current = nextLeft;
                    dragDepthRightRef.current = nextRight;
                    setDragDepthLeft(nextLeft);
                    setDragDepthRight(nextRight);
                    onResizePreview?.({ depthLeft: nextLeft, depthRight: nextRight });
                }
            } else if (activeDrag === 'right') {
                const newWidth = Math.max(MIN_DIMENSION_MM, snapToGrid(dragRef.current.initialW + deltaX));
                dragWidthRef.current = newWidth;
                setDragWidth(newWidth);
                onResizePreview?.({ width: newWidth });
            } else if (activeDrag === 'left') {
                const newWidth = Math.max(MIN_DIMENSION_MM, snapToGrid(dragRef.current.initialW - deltaX));
                dragWidthRef.current = newWidth;
                setDragWidth(newWidth);
                onResizePreview?.({ width: newWidth });
            } else if (activeDrag === 'depthLeft') {
                const next = Math.max(0, snapToGrid(dragRef.current.initialDLeft + deltaY));
                dragDepthLeftRef.current = next;
                setDragDepthLeft(next);
                onResizePreview?.({ depthLeft: next });
            } else if (activeDrag === 'depthRight') {
                const next = Math.max(0, snapToGrid(dragRef.current.initialDRight + deltaY));
                dragDepthRightRef.current = next;
                setDragDepthRight(next);
                onResizePreview?.({ depthRight: next });
            }
        };

        const handleUp = () => {
            setActiveDrag(null);
            const finalUpdate: Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>> = {};
            const resizeCommit = onResizeCommit || onResize;

            if (dragWidthRef.current !== null && dragWidthRef.current !== dragRef.current.initialW) {
                finalUpdate.width = snapToGrid(dragWidthRef.current);
            }
            if (equalDepth && dragDepthRef.current !== null && dragDepthRef.current !== dragRef.current.initialD) {
                finalUpdate.depth = snapToGrid(dragDepthRef.current);
            }
            if (dragDepthLeftRef.current !== null && dragDepthLeftRef.current !== dragRef.current.initialDLeft) {
                finalUpdate.depthLeft = snapToGrid(dragDepthLeftRef.current);
            }
            if (dragDepthRightRef.current !== null && dragDepthRightRef.current !== dragRef.current.initialDRight) {
                finalUpdate.depthRight = snapToGrid(dragDepthRightRef.current);
            }

            if (Object.keys(finalUpdate).length > 0) {
                resizeCommit?.(finalUpdate);
            } else {
                onResizePreview?.(null);
            }

            dragWidthRef.current = null;
            dragDepthRef.current = null;
            dragDepthLeftRef.current = null;
            dragDepthRightRef.current = null;
            setDragWidth(null);
            setDragDepth(null);
            setDragDepthLeft(null);
            setDragDepthRight(null);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [activeDrag, onResize, onResizePreview, onResizeCommit, viewHeight, viewWidth, equalDepth]);

    const [activeParasolDrag, setActiveParasolDrag] = useState<string | null>(null);
    const parasolDragRef = useRef<DraggedItemState | null>(null);

    const handlePolygonClick = useCallback((event) => {
        if (activeMode !== 'parasol' && activeMode !== 'fiesta') return;

        if (panRef.current) {
            const dx = Math.abs(event.clientX - panRef.current.startX);
            const dy = Math.abs(event.clientY - panRef.current.startY);
            if (dx > 5 || dy > 5) return;
        }

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const pointerX = (event.clientX - rect.left) / rect.width;
        const pointerY = (event.clientY - rect.top) / rect.height;

        const worldX = activeCamera.panX + pointerX * viewWidth;
        const worldY = activeCamera.panY + pointerY * viewHeight;

        if (activeMode === 'parasol') {
            onPlaceParasol?.(worldX, Math.max(0, worldY));
        } else if (activeMode === 'fiesta') {
            onPlaceFiesta?.(worldX, Math.max(0, worldY));
        }
    }, [activeMode, onPlaceFiesta, onPlaceParasol, activeCamera, viewWidth, viewHeight]);

    const beginParasolDrag = useCallback((id, event) => {
        if (activeMode !== 'parasol') return;
        event.preventDefault();
        event.stopPropagation();

        const parasol = parasols.find(p => p.id === id);
        if (!parasol) return;

        parasolDragRef.current = {
            id,
            startX: event.clientX,
            startY: event.clientY,
            initialX: parasol.xMm,
            initialY: parasol.yMm
        };
        setActiveParasolDrag(id);
    }, [activeMode, parasols]);

    useEffect(() => {
        if (!activeParasolDrag) return undefined;

        const handleMove = (event) => {
            const svg = svgRef.current;
            if (!svg || !parasolDragRef.current || !onMoveParasol) return;
            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const worldPerPixelX = viewWidth / rect.width;
            const worldPerPixelY = viewHeight / rect.height;
            const deltaX = (event.clientX - parasolDragRef.current.startX) * worldPerPixelX;
            const deltaY = (event.clientY - parasolDragRef.current.startY) * worldPerPixelY;

            const rawX = parasolDragRef.current.initialX + deltaX;
            const rawY = parasolDragRef.current.initialY + deltaY;

            // CAD alignments smart snapping
            const SNAP_THRESHOLD = 40; // 40 mm
            let snappedX = rawX;
            let snappedY = rawY;
            let activeSnapX: number | null = null;
            let activeSnapY: number | null = null;

            const centerlineX = currentWidth / 2;
            const centerlineY = currentMaxDepth / 2;

            // Snap X centerline or other items
            if (Math.abs(rawX - centerlineX) < SNAP_THRESHOLD) {
                snappedX = centerlineX;
                activeSnapX = centerlineX;
            } else {
                for (const other of parasols) {
                    if (other.id === activeParasolDrag) continue;
                    if (Math.abs(rawX - other.xMm) < SNAP_THRESHOLD) {
                        snappedX = other.xMm;
                        activeSnapX = other.xMm;
                        break;
                    }
                }
                if (activeSnapX === null) {
                    for (const other of fiestaItems) {
                        if (Math.abs(rawX - other.xMm) < SNAP_THRESHOLD) {
                            snappedX = other.xMm;
                            activeSnapX = other.xMm;
                            break;
                        }
                    }
                }
            }

            // Snap Y centerline or other items
            if (Math.abs(rawY - centerlineY) < SNAP_THRESHOLD) {
                snappedY = centerlineY;
                activeSnapY = centerlineY;
            } else {
                for (const other of parasols) {
                    if (other.id === activeParasolDrag) continue;
                    if (Math.abs(rawY - other.yMm) < SNAP_THRESHOLD) {
                        snappedY = other.yMm;
                        activeSnapY = other.yMm;
                        break;
                    }
                }
                if (activeSnapY === null) {
                    for (const other of fiestaItems) {
                        if (Math.abs(rawY - other.yMm) < SNAP_THRESHOLD) {
                            snappedY = other.yMm;
                            activeSnapY = other.yMm;
                            break;
                        }
                    }
                }
            }

            setSnapLines(activeSnapX !== null || activeSnapY !== null ? { x: activeSnapX, y: activeSnapY } : null);
            onMoveParasol(activeParasolDrag, snappedX, snappedY);
        };

        const handleUp = () => {
            setActiveParasolDrag(null);
            parasolDragRef.current = null;
            setSnapLines(null);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [activeParasolDrag, viewWidth, viewHeight, onMoveParasol, currentWidth, currentMaxDepth, parasols, fiestaItems]);

    const [activeFiestaDrag, setActiveFiestaDrag] = useState<string | null>(null);
    const fiestaDragRef = useRef<DraggedItemState | null>(null);

    const beginFiestaDrag = useCallback((id, event) => {
        if (activeMode !== 'fiesta') return;
        event.preventDefault();
        event.stopPropagation();

        const fiesta = fiestaItems.find((item) => item.id === id);
        if (!fiesta) return;

        fiestaDragRef.current = {
            id,
            startX: event.clientX,
            startY: event.clientY,
            initialX: fiesta.xMm,
            initialY: fiesta.yMm
        };
        setActiveFiestaDrag(id);
    }, [activeMode, fiestaItems]);

    useEffect(() => {
        if (!activeFiestaDrag) return undefined;

        const handleMove = (event) => {
            const svg = svgRef.current;
            if (!svg || !fiestaDragRef.current || !onMoveFiesta) return;
            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const worldPerPixelX = viewWidth / rect.width;
            const worldPerPixelY = viewHeight / rect.height;
            const deltaX = (event.clientX - fiestaDragRef.current.startX) * worldPerPixelX;
            const deltaY = (event.clientY - fiestaDragRef.current.startY) * worldPerPixelY;

            const rawX = fiestaDragRef.current.initialX + deltaX;
            const rawY = fiestaDragRef.current.initialY + deltaY;

            // CAD alignments smart snapping
            const SNAP_THRESHOLD = 40; // 40 mm
            let snappedX = rawX;
            let snappedY = rawY;
            let activeSnapX: number | null = null;
            let activeSnapY: number | null = null;

            const centerlineX = currentWidth / 2;
            const centerlineY = currentMaxDepth / 2;

            // Snap X centerline or other items
            if (Math.abs(rawX - centerlineX) < SNAP_THRESHOLD) {
                snappedX = centerlineX;
                activeSnapX = centerlineX;
            } else {
                for (const other of parasols) {
                    if (Math.abs(rawX - other.xMm) < SNAP_THRESHOLD) {
                        snappedX = other.xMm;
                        activeSnapX = other.xMm;
                        break;
                    }
                }
                if (activeSnapX === null) {
                    for (const other of fiestaItems) {
                        if (other.id === activeFiestaDrag) continue;
                        if (Math.abs(rawX - other.xMm) < SNAP_THRESHOLD) {
                            snappedX = other.xMm;
                            activeSnapX = other.xMm;
                            break;
                        }
                    }
                }
            }

            // Snap Y centerline or other items
            if (Math.abs(rawY - centerlineY) < SNAP_THRESHOLD) {
                snappedY = centerlineY;
                activeSnapY = centerlineY;
            } else {
                for (const other of parasols) {
                    if (Math.abs(rawY - other.yMm) < SNAP_THRESHOLD) {
                        snappedY = other.yMm;
                        activeSnapY = other.yMm;
                        break;
                    }
                }
                if (activeSnapY === null) {
                    for (const other of fiestaItems) {
                        if (other.id === activeFiestaDrag) continue;
                        if (Math.abs(rawY - other.yMm) < SNAP_THRESHOLD) {
                            snappedY = other.yMm;
                            activeSnapY = other.yMm;
                            break;
                        }
                    }
                }
            }

            setSnapLines(activeSnapX !== null || activeSnapY !== null ? { x: activeSnapX, y: activeSnapY } : null);
            onMoveFiesta(activeFiestaDrag, snappedX, snappedY);
        };

        const handleUp = () => {
            setActiveFiestaDrag(null);
            fiestaDragRef.current = null;
            setSnapLines(null);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [activeFiestaDrag, viewWidth, viewHeight, onMoveFiesta, currentWidth, currentMaxDepth, parasols, fiestaItems]);

    const startPan = useCallback(
        (event) => {
            if (activeDrag) return;
            if (event.button !== 0 && event.button !== 1) return;
            event.preventDefault();

            panRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                panX: activeCamera.panX,
                panY: activeCamera.panY
            };
        },
        [activeCamera.panX, activeCamera.panY, activeDrag]
    );

    useEffect(() => {
        const handleMove = (event) => {
            if (!panRef.current) return;
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const worldPerPixelX = viewWidth / rect.width;
            const worldPerPixelY = viewHeight / rect.height;
            const deltaX = (event.clientX - panRef.current.startX) * worldPerPixelX;
            const deltaY = (event.clientY - panRef.current.startY) * worldPerPixelY;
            emitCamera({
                zoom: activeCamera.zoom,
                panX: panRef.current.panX - deltaX,
                panY: panRef.current.panY - deltaY
            });
        };

        const handleUp = () => {
            panRef.current = null;
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [activeCamera.zoom, emitCamera, viewHeight, viewWidth]);

    const handleTouchStart = useCallback(
        (event) => {
            if (activeDrag) return;
            if (!svgRef.current) return;

            if (event.touches.length === 2) {
                event.preventDefault();
                const [a, b] = event.touches;
                const dx = b.clientX - a.clientX;
                const dy = b.clientY - a.clientY;
                const distance = Math.hypot(dx, dy);
                const centerX = (a.clientX + b.clientX) / 2;
                const centerY = (a.clientY + b.clientY) / 2;
                touchRef.current.pinch = {
                    distance,
                    camera: activeCamera,
                    centerX,
                    centerY
                };
                touchRef.current.singlePan = null;
            } else if (event.touches.length === 1) {
                const touch = event.touches[0];
                touchRef.current.singlePan = {
                    startX: touch.clientX,
                    startY: touch.clientY,
                    camera: activeCamera
                };
                touchRef.current.pinch = null;
            }
        },
        [activeCamera, activeDrag]
    );

    const handleTouchMove = useCallback(
        (event) => {
            if (activeDrag) return;
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            if (event.touches.length === 2 && touchRef.current.pinch) {
                event.preventDefault();
                const [a, b] = event.touches;
                const dx = b.clientX - a.clientX;
                const dy = b.clientY - a.clientY;
                const distance = Math.hypot(dx, dy);
                const pinch = touchRef.current.pinch;
                const scale = distance / pinch.distance;
                const nextZoom = clamp(pinch.camera.zoom * scale, 0.55, 3.5);

                const centerX = (a.clientX + b.clientX) / 2;
                const centerY = (a.clientY + b.clientY) / 2;

                const pointerX = (centerX - rect.left) / rect.width;
                const pointerY = (centerY - rect.top) / rect.height;

                const baseViewWidth = totalWidth / pinch.camera.zoom;
                const baseViewHeight = totalHeight / pinch.camera.zoom;
                const worldX = pinch.camera.panX + pointerX * baseViewWidth;
                const worldY = pinch.camera.panY + pointerY * baseViewHeight;

                const nextViewWidth = totalWidth / nextZoom;
                const nextViewHeight = totalHeight / nextZoom;

                emitCamera({
                    zoom: nextZoom,
                    panX: worldX - pointerX * nextViewWidth,
                    panY: worldY - pointerY * nextViewHeight
                });
            } else if (event.touches.length === 1 && touchRef.current.singlePan) {
                event.preventDefault();
                const touch = event.touches[0];
                const worldPerPixelX = viewWidth / rect.width;
                const worldPerPixelY = viewHeight / rect.height;
                const deltaX = (touch.clientX - touchRef.current.singlePan.startX) * worldPerPixelX;
                const deltaY = (touch.clientY - touchRef.current.singlePan.startY) * worldPerPixelY;

                emitCamera({
                    zoom: touchRef.current.singlePan.camera.zoom,
                    panX: touchRef.current.singlePan.camera.panX - deltaX,
                    panY: touchRef.current.singlePan.camera.panY - deltaY
                });
            }
        },
        [emitCamera, activeDrag, totalHeight, totalWidth, viewHeight, viewWidth]
    );

    const handleTouchEnd = useCallback((event) => {
        if (event.touches.length === 0) {
            touchRef.current.pinch = null;
            touchRef.current.singlePan = null;
        }
    }, []);

    const renderGrid = () => {
        const lines = [];
        const minor = 200;
        const major = 1000;

        const startX = Math.floor(activeCamera.panX / minor) * minor;
        const endX = Math.ceil((activeCamera.panX + viewWidth) / minor) * minor;
        const startY = Math.floor(activeCamera.panY / minor) * minor;
        const endY = Math.ceil((activeCamera.panY + viewHeight) / minor) * minor;

        for (let x = startX; x <= endX; x += minor) {
            const isMajor = x % major === 0;
            lines.push(
                <line
                    key={`grid-x-${x}`}
                    x1={x}
                    y1={startY}
                    x2={x}
                    y2={endY}
                    stroke={isMajor ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.08)'}
                    strokeWidth={isMajor ? 20 : 10}
                />
            );
        }

        for (let y = startY; y <= endY; y += minor) {
            const isMajor = y % major === 0;
            lines.push(
                <line
                    key={`grid-y-${y}`}
                    x1={startX}
                    y1={y}
                    x2={endX}
                    y2={y}
                    stroke={isMajor ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.08)'}
                    strokeWidth={isMajor ? 20 : 10}
                />
            );
        }

        return lines;
    };

    const renderPostAnchor = (key: string, cx: number, cy: number, isSelected: boolean, isInvalid: boolean, selectWholeEdge: (e: any) => void) => {
        const radius = sectionThickness * 0.95;
        return (
            <g
                key={key}
                style={{ cursor: 'pointer' }}
                onClick={selectWholeEdge}
            >
                {/* Outer Selection Glow underlay */}
                {(isSelected || isInvalid) && (
                    <circle
                        cx={cx}
                        cy={cy}
                        r={radius + 40}
                        fill="transparent"
                        stroke={isInvalid ? '#ef4444' : '#3b82f6'}
                        strokeWidth="30"
                        opacity={isInvalid ? 0.8 : 0.65}
                    />
                )}
                {/* Brushed Metal Base Circle */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="url(#metalPostGrad)"
                    stroke="#1e293b"
                    strokeWidth="10"
                />
                {/* Concentric Polished Cap */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius * 0.7}
                    fill="url(#metalCapGrad)"
                    stroke="#334155"
                    strokeWidth="4"
                />
                {/* Inner Bolt / Center pin */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius * 0.22}
                    fill="#0f172a"
                    stroke="#475569"
                    strokeWidth="4"
                />
            </g>
        );
    };

    const renderSegment = (edgeKey, segment, geometry, isSelectedEdge, isSelectedSection) => {
        const fill = segment.isDoor
            ? 'url(#doorGrad)'
            : isSelectedSection
                ? 'url(#selectedSectionGrad)'
                : isSelectedEdge
                    ? 'url(#selectedEdgeGrad)'
                    : 'url(#glassGrad)';

        const stroke = segment.isDoor
            ? 'rgba(16,185,129,0.95)'
            : isSelectedSection
                ? 'rgba(245,158,11,0.95)'
                : isSelectedEdge
                    ? 'rgba(59,130,246,0.95)'
                    : 'rgba(148,163,184,0.7)';

        return (
            <g
                key={segment.key}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge?.(edgeKey);
                    onSelectSection?.(edgeKey, segment.index);
                }}
            >
                {/* Outer glowing border for selected section */}
                {isSelectedSection && (
                    <rect
                        x={geometry.x - 20}
                        y={geometry.y - 20}
                        width={geometry.w + 40}
                        height={geometry.h + 40}
                        fill="transparent"
                        stroke="rgba(245,158,11,0.3)"
                        strokeWidth="30"
                        rx="28"
                    />
                )}
                {/* Translucent Glass Body */}
                <rect
                    x={geometry.x}
                    y={geometry.y}
                    width={geometry.w}
                    height={geometry.h}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelectedSection ? 36 : isSelectedEdge ? 28 : 20}
                    rx="18"
                />
                {/* Diagonal glass light reflection lines */}
                {!segment.isDoor && geometry.w > 120 && (
                    <line
                        x1={geometry.x + 40}
                        y1={geometry.y + 15}
                        x2={geometry.x + Math.min(geometry.w - 40, 200)}
                        y2={geometry.y + geometry.h - 15}
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                )}
                <text
                    x={geometry.tx}
                    y={geometry.ty}
                    fill={isSelectedSection ? '#fbbf24' : isSelectedEdge ? '#ffffff' : '#e2e8f0'}
                    fontSize={labelFont}
                    fontFamily="Inter, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="700"
                >
                    {segment.label}
                </text>
            </g>
        );
    };

    const renderProposedSegment = (edgeKey, segment, geometry) => {
        return (
            <g key={`preview-${segment.key}`}>
                <rect
                    x={geometry.x}
                    y={geometry.y}
                    width={geometry.w}
                    height={geometry.h}
                    fill="transparent"
                    stroke="#f97316"
                    strokeWidth="15"
                    strokeDasharray="25 15"
                    filter="url(#orangeGlow)"
                    rx="18"
                />
                <text
                    x={geometry.tx}
                    y={geometry.ty}
                    fill="#fdba74"
                    fontSize={labelFont}
                    fontFamily="Inter, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="700"
                >
                    {segment.label}
                </text>
            </g>
        );
    };

    const renderProposedEdge = (edgeKey, startX, startY, direction, previewLayout) => {
        const summary = previewLayout.edgeSummaries[edgeKey];
        if (!summary || summary.enabled === false) return null;
        const segments = summary.segments || [];
        const objects = [];

        let cx = startX;
        let cy = startY;

        objects.push(
            <circle
                key={`preview-post-start-${edgeKey}`}
                cx={cx}
                cy={cy}
                r={sectionThickness * 0.95}
                fill="transparent"
                stroke="#f97316"
                strokeWidth="12"
                strokeDasharray="15 10"
                filter="url(#orangeGlow)"
            />
        );

        segments.forEach((segment) => {
            const len = Number(segment.length) || 0;
            const geometry = direction === 'E'
                ? {
                    x: cx,
                    y: cy - sectionThickness / 2,
                    w: len,
                    h: sectionThickness,
                    tx: cx + len / 2,
                    ty: cy + sectionThickness + 210
                }
                : {
                    x: cx - sectionThickness / 2,
                    y: cy,
                    w: sectionThickness,
                    h: len,
                    tx: cx - sectionThickness - 260,
                    ty: cy + len / 2
                };

            objects.push(renderProposedSegment(edgeKey, segment, geometry));

            if (direction === 'E') {
                cx += len;
            } else {
                cy += len;
            }

            objects.push(
                <circle
                    key={`preview-post-${edgeKey}-${segment.key}`}
                    cx={cx}
                    cy={cy}
                    r={sectionThickness * 0.95}
                    fill="transparent"
                    stroke="#f97316"
                    strokeWidth="12"
                    strokeDasharray="15 10"
                    filter="url(#orangeGlow)"
                />
            );
        });

        return objects;
    };

    const renderEdge = (edgeKey, startX, startY, direction) => {
        const summary = summaryByEdge[edgeKey] || { segments: [] };
        if (summary.enabled === false) {
            return [];
        }
        const segments = summary.segments || [];
        const diagnostics = edgeDiagnostics[edgeKey];
        const isInvalid = diagnostics?.valid === false;
        const isSelected = selectedEdge === edgeKey;
        const objects = [];
        const selectWholeEdge = (event) => {
            event.stopPropagation();
            onSelectEdge?.(edgeKey);
            onSelectSection?.(edgeKey, null);
        };

        let cx = startX;
        let cy = startY;

        objects.push(
            renderPostAnchor(`post-start-${edgeKey}`, cx, cy, isSelected, isInvalid, selectWholeEdge)
        );

        segments.forEach((segment) => {
            const len = Number(segment.length) || 0;

            const geometry = direction === 'E'
                ? {
                    x: cx,
                    y: cy - sectionThickness / 2,
                    w: len,
                    h: sectionThickness,
                    tx: cx + len / 2,
                    ty: cy + sectionThickness + 210
                }
                : {
                    x: cx - sectionThickness / 2,
                    y: cy,
                    w: sectionThickness,
                    h: len,
                    tx: cx - sectionThickness - 260,
                    ty: cy + len / 2
                };

            const isSelectedSection = isSelected && selection?.segmentIndex === segment.index;
            objects.push(renderSegment(edgeKey, segment, geometry, isSelected, isSelectedSection));

            if (direction === 'E') {
                cx += len;
            } else {
                cy += len;
            }

            objects.push(
                renderPostAnchor(`post-${edgeKey}-${segment.key}`, cx, cy, isSelected, isInvalid, selectWholeEdge)
            );
        });

        if (summary.leadingPostMm > 0 && !isInvalid) {
            const postLen = summary.leadingPostMm;
            const postGeo = direction === 'E'
                ? { x: cx, y: cy - sectionThickness / 2, w: postLen, h: sectionThickness }
                : { x: cx - sectionThickness / 2, y: cy, w: sectionThickness, h: postLen };

            objects.push(
                <rect
                    key={`leading-post-${edgeKey}`}
                    x={postGeo.x}
                    y={postGeo.y}
                    width={postGeo.w}
                    height={postGeo.h}
                    fill="rgba(100,116,139,0.5)"
                    stroke="rgba(148,163,184,0.65)"
                    strokeWidth={20}
                    rx="10"
                    style={{ cursor: 'pointer' }}
                    onClick={selectWholeEdge}
                />
            );
        }

        if (isInvalid) {
            const tx = direction === 'E' ? startX + (edgeKey === 'front' || edgeKey === 'back' ? currentWidth / 2 : 550) : startX - 400;
            const ty = direction === 'E' ? startY + 320 : startY + 400;
            objects.push(
                <g key={`invalid-${edgeKey}`}>
                    <rect x={tx - 700} y={ty - 170} width={1400} height={340} fill="rgba(127,29,29,0.92)" rx="50" />
                    <text
                        x={tx}
                        y={ty}
                        fill="#fee2e2"
                        fontSize="140"
                        fontFamily="Inter, sans-serif"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="700"
                    >
                        OGILTIG KANT
                    </text>
                </g>
            );
        }

        return objects;
    };

    const renderDimensions = () => {
        const leftStartY = currentMaxDepth - currentDepthLeft;
        const rightStartY = currentMaxDepth - currentDepthRight;
        const sideDimOffset = sectionThickness + (uiDensity === 'touch' ? 760 : 640);
        const sideDimTick = uiDensity === 'touch' ? 90 : 80;
        const sideDimLabelOffset = uiDensity === 'touch' ? 360 : 320;
        const bottomDimY = currentMaxDepth + sectionThickness + (uiDensity === 'touch' ? 660 : 620);
        const bottomTick = uiDensity === 'touch' ? 100 : 90;
        const bottomLabelY = bottomDimY + (uiDensity === 'touch' ? 340 : 300);
        const dimFontSize = uiDensity === 'touch' ? 180 : 170;

        const renderDimensionLabel = ({ x, y, text, rotate = 0, dimKey, currentValue }) => {
            const isEditing = activeEditingDim === dimKey;

            return (
                <g transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}>
                    {isEditing ? (
                        <foreignObject
                            x={x - 400}
                            y={y - 110}
                            width="800"
                            height="220"
                            style={{ overflow: 'visible' }}
                        >
                            <div className="flex items-center justify-center w-full h-full" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="number"
                                    autoFocus
                                    value={dimInputValue}
                                    onChange={(e) => setDimInputValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCommitDim(dimKey, dimInputValue);
                                        } else if (e.key === 'Escape') {
                                            setActiveEditingDim(null);
                                        }
                                    }}
                                    onBlur={() => handleCommitDim(dimKey, dimInputValue)}
                                    style={{
                                        width: '600px',
                                        height: '160px',
                                        fontSize: '95px',
                                        fontWeight: '700',
                                        textAlign: 'center',
                                        color: '#ffffff',
                                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                        border: '8px solid #3b82f6',
                                        borderRadius: '40px',
                                        boxShadow: '0 0 40px rgba(59, 130, 246, 0.6)',
                                        outline: 'none',
                                        fontFamily: 'Inter, sans-serif'
                                    }}
                                />
                            </div>
                        </foreignObject>
                    ) : (
                        <text
                            x={x}
                            y={y}
                            fill="#e2e8f0"
                            stroke="rgba(2,6,23,0.88)"
                            strokeWidth={uiDensity === 'touch' ? 30 : 24}
                            paintOrder="stroke"
                            strokeLinejoin="round"
                            fontSize={dimFontSize}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontWeight="700"
                            fontFamily="Inter, sans-serif"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveEditingDim(dimKey);
                                setDimInputValue(String(Math.round(currentValue)));
                            }}
                            title="Klicka för att ändra mått"
                        >
                            {text}
                        </text>
                    )}
                </g>
            );
        };

        const leftEffective = summaryByEdge.left?.effectiveLength ?? currentDepthLeft;
        const rightEffective = summaryByEdge.right?.effectiveLength ?? currentDepthRight;
        const frontEffective = summaryByEdge.front?.effectiveLength ?? currentWidth;
        const showLeftDepth = (summaryByEdge.left?.enabled ?? true) && leftEffective > 0;
        const showRightDepth = (summaryByEdge.right?.enabled ?? true) && rightEffective > 0;

        return (
            <>
                {/* ── Width dimension (bottom) ── */}
                <line x1={0} y1={bottomDimY} x2={frontEffective} y2={bottomDimY} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                <line x1={0} y1={bottomDimY - bottomTick} x2={0} y2={bottomDimY + bottomTick} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                <line x1={frontEffective} y1={bottomDimY - bottomTick} x2={frontEffective} y2={bottomDimY + bottomTick} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                {renderDimensionLabel({
                    x: frontEffective / 2,
                    y: bottomLabelY,
                    text: `${Math.round(frontEffective)} mm`,
                    dimKey: 'width',
                    currentValue: frontEffective
                })}

                {/* ── Left depth dimension ── */}
                {showLeftDepth && (
                    <>
                        <line x1={-sideDimOffset} y1={leftStartY} x2={-sideDimOffset} y2={leftStartY + leftEffective} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                        <line x1={-(sideDimOffset + sideDimTick)} y1={leftStartY} x2={-(sideDimOffset - sideDimTick)} y2={leftStartY} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                        <line x1={-(sideDimOffset + sideDimTick)} y1={leftStartY + leftEffective} x2={-(sideDimOffset - sideDimTick)} y2={leftStartY + leftEffective} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                        {renderDimensionLabel({
                            x: -(sideDimOffset + sideDimLabelOffset),
                            y: leftStartY + leftEffective / 2,
                            text: `${Math.round(leftEffective)} mm`,
                            rotate: -90,
                            dimKey: 'depthLeft',
                            currentValue: leftEffective
                        })}
                    </>
                )}

                {/* ── Right depth dimension ── */}
                {showRightDepth && (
                    <>
                        <line x1={currentWidth + sideDimOffset} y1={rightStartY} x2={currentWidth + sideDimOffset} y2={rightStartY + rightEffective} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                        <line x1={currentWidth + sideDimOffset - sideDimTick} y1={rightStartY} x2={currentWidth + sideDimOffset + sideDimTick} y2={rightStartY} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                        <line x1={currentWidth + sideDimOffset - sideDimTick} y1={rightStartY + rightEffective} x2={currentWidth + sideDimOffset + sideDimTick} y2={rightStartY + rightEffective} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
                        {renderDimensionLabel({
                            x: currentWidth + sideDimOffset + sideDimLabelOffset,
                            y: rightStartY + rightEffective / 2,
                            text: `${Math.round(rightEffective)} mm`,
                            rotate: 90,
                            dimKey: 'depthRight',
                            currentValue: rightEffective
                        })}
                    </>
                )}
            </>
        );
    };

    const DragHandle = ({ x, y, edgeId, cursor }) => (
        <g
            style={{ cursor, pointerEvents: 'all' }}
            onMouseDown={(event) => beginResize(edgeId, event)}
        >
            <circle cx={x} cy={y} r={handleHit} fill="transparent" />
            <circle
                cx={x}
                cy={y}
                r={handleSize}
                fill={activeDrag === edgeId ? '#2563eb' : '#3b82f6'}
                stroke="#ffffff"
                strokeWidth="30"
                opacity={1}
            />
        </g>
    );

    const renderParasols = () => {
        const inverseZoom = 1 / Math.max(0.1, camera.zoom);
        const BASE_UI_SCALE = 9.0;

        return parasols.map((p) => {
            const isSelected = p.id === selectedParasolId;
            const dims = getEffectiveParasolDimensions(p);
            const px = p.xMm - dims.widthMm / 2;
            const py = p.yMm - dims.depthMm / 2;
            const isRotatable = isParasolRotatable(p);
            const isRotated = getParasolRotationDeg(p) === 90;
            const hasErr = hasCollision(p.id, 'parasol');

            return (
                <g
                    key={p.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (activeMode === 'parasol' && onSelectParasol) {
                            onSelectParasol(p.id);
                        }
                    }}
                    onMouseDown={(e) => {
                        if (activeMode !== 'parasol') return;
                        e.stopPropagation();
                        if (onSelectParasol && p.id !== selectedParasolId) {
                            onSelectParasol(p.id);
                        }
                        beginParasolDrag(p.id, e);
                    }}
                    style={{ cursor: activeMode === 'parasol' ? 'move' : 'default', pointerEvents: activeMode === 'parasol' ? 'all' : 'none' }}
                >
                    {/* Collision Alarm Pulsing ring */}
                    {hasErr && (
                        <rect
                            x={px - 25}
                            y={py - 25}
                            width={dims.widthMm + 50}
                            height={dims.depthMm + 50}
                            fill="transparent"
                            stroke="#ef4444"
                            strokeWidth="30"
                            strokeDasharray="40 20"
                            filter="url(#warningGlow)"
                            rx="10"
                        >
                            <animate attributeName="opacity" values="0.45;1.0;0.45" dur="1.8s" repeatCount="indefinite" />
                        </rect>
                    )}

                    <rect
                        x={px}
                        y={py}
                        width={dims.widthMm}
                        height={dims.depthMm}
                        fill={isSelected ? 'rgba(59,130,246,0.3)' : 'rgba(241,245,249,0.1)'}
                        stroke={hasErr ? '#ef4444' : isSelected ? '#3b82f6' : 'rgba(203,213,225,0.4)'}
                        strokeWidth={isSelected ? 30 : 20}
                        filter={hasErr ? 'url(#warningGlow)' : undefined}
                    />
                    {isSelected && isRotatable && (
                        <line
                            x1={isRotated ? p.xMm : px}
                            y1={isRotated ? py : p.yMm}
                            x2={isRotated ? p.xMm : px + dims.widthMm}
                            y2={isRotated ? py + dims.depthMm : p.yMm}
                            stroke="rgba(191,219,254,0.95)"
                            strokeWidth="24"
                            strokeLinecap="round"
                            pointerEvents="none"
                        />
                    )}

                    {/* Exclamation Warning Badge */}
                    {hasErr && (
                        <g>
                            <circle
                                cx={px + dims.widthMm}
                                cy={py}
                                r="100"
                                fill="#ef4444"
                                stroke="#ffffff"
                                strokeWidth="18"
                                filter="url(#warningGlow)"
                            />
                            <text
                                x={px + dims.widthMm}
                                y={py}
                                fill="#ffffff"
                                fontSize="150"
                                fontWeight="900"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontFamily="Inter, sans-serif"
                            >
                                !
                            </text>
                        </g>
                    )}

                    {/* On-Canvas Toolbar for the selected parasol */}
                    {isSelected && (
                        <foreignObject
                            x={px}
                            y={py - (40 * inverseZoom * BASE_UI_SCALE)}
                            width={dims.widthMm}
                            height={40 * inverseZoom * BASE_UI_SCALE}
                            style={{ overflow: 'visible', pointerEvents: 'all' }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                style={{
                                    transform: `scale(${inverseZoom * BASE_UI_SCALE})`,
                                    transformOrigin: 'bottom center',
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'center',
                                    paddingBottom: '8px'
                                }}
                            >
                                <div className="bg-panel-bg border border-panel-border rounded-xl shadow-xl p-1.5 flex gap-1.5 items-center backdrop-blur-md">
                                    <select
                                        value={p.presetId || ''}
                                        onChange={(e) => {
                                            if (onChangeParasolPreset) onChangeParasolPreset(p.id, e.target.value);
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="bg-input-bg border border-panel-border rounded text-text-primary px-2 py-1 text-sm outline-none focus:border-primary cursor-pointer"
                                    >
                                        {groupParasolPresetsByCategory(PARASOL_PRESETS).map((group) => (
                                            <optgroup key={group.category} label={group.category}>
                                                {group.presets.map((preset) => (
                                                    <option key={preset.id} value={preset.id}>
                                                        {preset.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>

                                    {isRotatable && (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={() => onRotateParasol && onRotateParasol(p.id, getParasolRotationDeg(p) === 90 ? 0 : 90)}
                                            className="px-2.5 py-1 text-sm font-semibold rounded bg-panel-bg text-text-secondary border border-panel-border hover:text-text-primary hover:bg-white/5 transition-colors"
                                            title="Rotera"
                                        >
                                            ↻ Rotera
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={() => onDeleteParasol && onDeleteParasol(p.id)}
                                        className="px-2.5 py-1 text-sm font-semibold rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                                        title="Ta bort"
                                    >
                                        🗑 Ta bort
                                    </button>
                                </div>
                            </div>
                        </foreignObject>
                    )}
                </g>
            );
        });
    };

    const renderFiestaItems = (zLayer) => {
        return fiestaItems
            .filter((fiesta) => (fiesta.zLayer || 'below') === zLayer)
            .map((fiesta) => {
                const isSelected = fiesta.id === selectedFiestaId;
                const radiusMm = getFiestaRadiusMm(fiesta);
                const hasErr = hasCollision(fiesta.id, 'fiesta');

                return (
                    <g
                        key={fiesta.id}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (activeMode === 'fiesta' && onSelectFiesta) {
                                onSelectFiesta(fiesta.id);
                            }
                        }}
                        onMouseDown={(e) => {
                            if (activeMode !== 'fiesta') return;
                            e.stopPropagation();
                            if (onSelectFiesta && fiesta.id !== selectedFiestaId) {
                                onSelectFiesta(fiesta.id);
                            }
                            beginFiestaDrag(fiesta.id, e);
                        }}
                        style={{ cursor: activeMode === 'fiesta' ? 'move' : 'default', pointerEvents: activeMode === 'fiesta' ? 'all' : 'none' }}
                    >
                        {/* Collision Alarm Pulsing Ring */}
                        {hasErr && (
                            <circle
                                cx={fiesta.xMm}
                                cy={fiesta.yMm}
                                r={radiusMm + 25}
                                fill="transparent"
                                stroke="#ef4444"
                                strokeWidth="30"
                                strokeDasharray="40 20"
                                filter="url(#warningGlow)"
                            >
                                <animate attributeName="opacity" values="0.45;1.0;0.45" dur="1.8s" repeatCount="indefinite" />
                            </circle>
                        )}

                        <circle
                            cx={fiesta.xMm}
                            cy={fiesta.yMm}
                            r={radiusMm}
                            fill={zLayer === 'above'
                                ? (isSelected ? 'rgba(251,191,36,0.30)' : 'rgba(250,204,21,0.18)')
                                : (isSelected ? 'rgba(148,163,184,0.26)' : 'rgba(226,232,240,0.14)')}
                            stroke={hasErr ? '#ef4444' : isSelected ? '#f59e0b' : 'rgba(226,232,240,0.55)'}
                            strokeWidth={isSelected ? 30 : 20}
                            filter={hasErr ? 'url(#warningGlow)' : undefined}
                        />

                        {/* Exclamation Warning Badge */}
                        {hasErr && (
                            <g>
                                <circle
                                    cx={fiesta.xMm + radiusMm * 0.7}
                                    cy={fiesta.yMm - radiusMm * 0.7}
                                    r="100"
                                    fill="#ef4444"
                                    stroke="#ffffff"
                                    strokeWidth="18"
                                    filter="url(#warningGlow)"
                                />
                                <text
                                    x={fiesta.xMm + radiusMm * 0.7}
                                    y={fiesta.yMm - radiusMm * 0.7}
                                    fill="#ffffff"
                                    fontSize="150"
                                    fontWeight="900"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontFamily="Inter, sans-serif"
                                >
                                    !
                                </text>
                            </g>
                        )}
                    </g>
                );
            });
    };

    const renderSegmentToolbar = () => {
        if (!selectedSegmentToolbarInfo) return null;

        const { edgeKey, segment, geometry, direction } = selectedSegmentToolbarInfo;
        const index = segment.index;

        const toolbarWidth = 900;
        const toolbarHeight = 220;

        const SECTION_SIZES = [2000, 1900, 1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100, 1000, 700];
        const DOOR_SIZES = [1100, 1000, 700];
        const currentSizeList = segment.isDoor ? DOOR_SIZES : SECTION_SIZES;
        
        const inverseZoom = 1 / activeCamera.zoom;
        const BASE_UI_SCALE = 4.5; 
        const currentScale = inverseZoom * BASE_UI_SCALE;

        const scaledWidth = toolbarWidth * currentScale;
        const scaledHeight = toolbarHeight * currentScale;
        const scaledGap = 80 * currentScale;

        let tx = 0;
        let ty = 0;

        if (direction === 'E') {
            tx = geometry.tx - scaledWidth / 2;
            if (edgeKey === 'front') {
                ty = geometry.y - scaledHeight - scaledGap;
            } else {
                ty = geometry.y + sectionThickness + scaledGap;
            }
        } else {
            ty = geometry.ty - scaledHeight / 2;
            if (edgeKey === 'left') {
                tx = geometry.x + sectionThickness + scaledGap;
            } else {
                tx = geometry.x - sectionThickness - scaledWidth - scaledGap;
            }
        }

        const isPinned = (manualSectionsByEdge[edgeKey] || []).some((pin) => pin.index === index);

        const handleTogglePin = () => {
            if (isPinned) {
                onSetManualPin?.(edgeKey, index, null);
            } else {
                onSetManualPin?.(edgeKey, index, segment.length);
            }
        };

        const handleToggleDoor = () => {
            if (segment.isDoor) {
                onResetDoorSegment?.(edgeKey, index);
            } else {
                onSetDoorSegmentSize?.(edgeKey, index, 1000);
            }
        };

        const handleStepResize = (delta: number) => {
            const nextSize = snapToGrid(segment.length + delta);
            const minAllowed = 700;
            const clamped = Math.max(minAllowed, nextSize);
            if (segment.isDoor) {
                onSetDoorSegmentSize?.(edgeKey, index, clamped);
            } else {
                onSetManualPin?.(edgeKey, index, clamped);
            }
        };

        const handleSizeSelect = (e: any) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                if (segment.isDoor) {
                    onSetDoorSegmentSize?.(edgeKey, index, val);
                } else {
                    onSetManualPin?.(edgeKey, index, val);
                }
            }
        };

        return (
            <foreignObject
                x={tx}
                y={ty}
                width={scaledWidth}
                height={scaledHeight}
                style={{ overflow: 'visible' }}
            >
                <div
                    className="flex items-center justify-between p-4 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-[32px] shadow-[0_16px_48px_rgba(0,0,0,0.7)] text-white select-none gap-4"
                    onClick={(e) => e.stopPropagation()}
                    style={{ 
                        width: '900px', 
                        height: '220px',
                        transform: `scale(${currentScale})`,
                        transformOrigin: 'top left'
                    }}
                >
                    <button
                        type="button"
                        onClick={handleTogglePin}
                        className={`flex items-center justify-center gap-2.5 h-[140px] px-5 rounded-[24px] border font-bold text-[28px] transition-all duration-200 active:scale-95 flex-1 ${
                            isPinned
                                ? 'bg-amber-600/40 text-amber-300 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                                : 'bg-slate-800 text-slate-300 border-slate-700/60 hover:bg-slate-700 hover:text-white'
                        }`}
                        title={isPinned ? 'Lås upp sektionsbredd' : 'Lås denna sektionsbredd'}
                    >
                        <span className="text-[36px]">{isPinned ? '🔒' : '🔓'}</span>
                        <span>{isPinned ? 'Låst' : 'Lås'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleToggleDoor}
                        className={`flex items-center justify-center gap-2.5 h-[140px] px-5 rounded-[24px] border font-bold text-[28px] transition-all duration-200 active:scale-95 flex-1 ${
                            segment.isDoor
                                ? 'bg-emerald-600/40 text-emerald-300 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                : 'bg-slate-800 text-slate-300 border-slate-700/60 hover:bg-slate-700 hover:text-white'
                        }`}
                        title={segment.isDoor ? 'Gör till vanlig glassektion' : 'Gör till dörrsektion'}
                    >
                        <span className="text-[36px]">🚪</span>
                        <span>{segment.isDoor ? 'Dörr' : 'Sektion'}</span>
                    </button>

                    <div className="flex items-center h-[140px] border border-slate-700/60 rounded-[24px] overflow-hidden bg-slate-900/60">
                        <button
                            type="button"
                            onClick={() => handleStepResize(-100)}
                            className="flex items-center justify-center w-[85px] h-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-[36px] border-r border-slate-700/60 active:bg-slate-600 transition-colors"
                            title="Minska med 100 mm"
                        >
                            -
                        </button>
                        <span className="flex items-center justify-center w-[120px] h-full text-center font-bold text-[28px] text-slate-200">
                            100
                        </span>
                        <button
                            type="button"
                            onClick={() => handleStepResize(100)}
                            className="flex items-center justify-center w-[85px] h-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-[36px] border-l border-slate-700/60 active:bg-slate-600 transition-colors"
                            title="Öka med 100 mm"
                        >
                            +
                        </button>
                    </div>

                    <div className="relative h-[140px] flex-1">
                        <select
                            value={segment.length}
                            onChange={handleSizeSelect}
                            className="w-full h-full bg-slate-800 text-white rounded-[24px] border border-slate-700/60 px-5 text-[28px] font-bold outline-none cursor-pointer hover:bg-slate-750 transition-colors appearance-none pr-12 focus:border-blue-500"
                        >
                            {currentSizeList.map((sz) => (
                                <option key={sz} value={sz}>
                                    {sz} mm
                                </option>
                            ))}
                            {!currentSizeList.includes(segment.length) && (
                                <option value={segment.length}>
                                    {segment.length} mm*
                                </option>
                            )}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[28px] text-slate-400">
                            ▾
                        </div>
                    </div>
                </div>
            </foreignObject>
        );
    };

    return (
        <div id="sketchCanvasContainer" className="relative w-full h-full bg-[#0b1220] overflow-hidden rounded-xl border border-panel-border shadow-2xl">
            {/* Absolute floating toolbar for canvas modes and zoom */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none" data-html2canvas-ignore="true">
                <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-4 bg-panel-bg/80 backdrop-blur-md border border-panel-border rounded-[24px] px-5 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            aria-pressed={activeMode === 'clickitup'}
                            onClick={() => onChangeMode && onChangeMode('clickitup')}
                            className={`h-8 px-3 rounded-md border text-xs font-semibold tracking-wide transition-all ${activeMode === 'clickitup'
                                ? 'bg-primary/95 text-white border-blue-200/60 shadow-[0_0_0_1px_rgba(191,219,254,0.55),0_8px_18px_rgba(37,99,235,0.35)]'
                                : 'bg-blue-900/20 text-blue-300 border-blue-800/50 hover:text-white hover:border-blue-500/60 hover:bg-blue-800/40'
                                }`}
                        >
                            ClickitUp
                        </button>
                        <button
                            type="button"
                            aria-pressed={activeMode === 'parasol'}
                            onClick={() => onChangeMode && onChangeMode('parasol')}
                            className={`h-8 px-3 rounded-md border text-xs font-semibold tracking-wide transition-all ${activeMode === 'parasol'
                                ? 'bg-emerald-600/95 text-white border-emerald-300/60 shadow-[0_0_0_1px_rgba(110,231,183,0.55),0_8px_18px_rgba(5,150,105,0.35)]'
                                : 'bg-emerald-900/20 text-emerald-300 border-emerald-800/50 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-800/40'
                                }`}
                        >
                            Parasoll
                        </button>
                        <button
                            type="button"
                            aria-pressed={activeMode === 'fiesta'}
                            onClick={() => onChangeMode && onChangeMode('fiesta')}
                            className={`h-8 px-3 rounded-md border text-xs font-semibold tracking-wide transition-all ${activeMode === 'fiesta'
                                ? 'bg-amber-500/95 text-white border-amber-200/60 shadow-[0_0_0_1px_rgba(253,230,138,0.55),0_8px_18px_rgba(217,119,6,0.35)]'
                                : 'bg-amber-900/20 text-amber-300 border-amber-800/50 hover:text-white hover:border-amber-500/60 hover:bg-amber-800/40'
                                }`}
                        >
                            Fiesta
                        </button>
                        <span className="rounded-full border border-panel-border bg-input-bg px-2.5 py-1 text-xs font-medium text-text-primary">
                            {activeSelectionLabel}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="h-8 px-3 rounded-md border border-panel-border bg-input-bg text-xs font-semibold text-text-primary hover:bg-white/5 transition-colors"
                        >
                            Zoom -
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="h-8 px-3 rounded-md border border-panel-border bg-input-bg text-xs font-semibold text-text-primary hover:bg-white/5 transition-colors"
                        >
                            Zoom +
                        </button>
                        <button
                            type="button"
                            onClick={handleFitView}
                            className="h-8 px-3 rounded-md border border-panel-border bg-input-bg text-xs font-semibold text-text-primary hover:bg-white/5 transition-colors"
                        >
                            Anpassa vy
                        </button>
                        <span className="text-xs text-text-secondary">
                            Zoom: <b className="text-text-primary">{activeCamera.zoom.toFixed(2)}x</b>
                        </span>
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 z-0">
                <svg
                    ref={svgRef}
                    viewBox={viewBox}
                    className="w-full h-full touch-none"
                    onWheel={handleWheel}
                    onMouseDown={startPan}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <defs>
                        {/* Teal-cyan linear gradient for glass sections */}
                        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0891b2" stopOpacity="0.45" />
                            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.45" />
                        </linearGradient>

                        {/* Green-emerald linear gradient for doors */}
                        <linearGradient id="doorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#059669" stopOpacity="0.5" />
                            <stop offset="50%" stopColor="#10b981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#059669" stopOpacity="0.5" />
                        </linearGradient>

                        {/* Amber-orange linear gradient for selection */}
                        <linearGradient id="selectedSectionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#d97706" stopOpacity="0.6" />
                            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#d97706" stopOpacity="0.6" />
                        </linearGradient>

                        {/* Blue-indigo linear gradient for selected edges */}
                        <linearGradient id="selectedEdgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.55" />
                            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.55" />
                        </linearGradient>

                        {/* Brushed metal post post anchors (slate horizontal) */}
                        <linearGradient id="metalPostGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#475569" />
                            <stop offset="25%" stopColor="#94a3b8" />
                            <stop offset="50%" stopColor="#cbd5e1" />
                            <stop offset="75%" stopColor="#94a3b8" />
                            <stop offset="100%" stopColor="#475569" />
                        </linearGradient>

                        {/* Concentric polished caps (radial slate-light) */}
                        <radialGradient id="metalCapGrad" cx="30%" cy="30%" r="70%">
                            <stop offset="0%" stopColor="#f1f5f9" />
                            <stop offset="50%" stopColor="#cbd5e1" />
                            <stop offset="100%" stopColor="#475569" />
                        </radialGradient>

                        {/* Red warning glow filter */}
                        <filter id="warningGlow" x="-30%" y="-30%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="0" stdDeviation="22" floodColor="#ef4444" floodOpacity="0.9" />
                        </filter>

                        {/* Orange preview glow filter */}
                        <filter id="orangeGlow" x="-30%" y="-30%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="0" stdDeviation="22" floodColor="#f97316" floodOpacity="0.85" />
                        </filter>
                    </defs>

                    {renderGrid()}
                    <line x1={-padding} y1={0} x2={currentWidth + padding} y2={0} stroke="rgba(30,64,175,0.4)" strokeWidth="18" />
                    <line x1={0} y1={-padding} x2={0} y2={currentMaxDepth + padding} stroke="rgba(30,64,175,0.4)" strokeWidth="18" />

                    <polygon
                        points={`0,${currentMaxDepth} ${currentWidth},${currentMaxDepth} ${currentWidth},${currentMaxDepth - currentDepthRight} 0,${currentMaxDepth - currentDepthLeft}`}
                        fill="rgba(15,23,42,0.22)"
                        stroke="rgba(59,130,246,0.55)"
                        strokeWidth="26"
                        strokeDasharray="100 70"
                        onMouseUp={handlePolygonClick}
                        style={{ pointerEvents: activeMode === 'parasol' || activeMode === 'fiesta' ? 'all' : 'none' }}
                    />

                    {/* standard drawing layer, dimmed if a recommendation preview is actively showing */}
                    <g opacity={isShowingPreview ? 0.35 : 1.0}>
                        {renderEdge('front', 0, currentMaxDepth, 'E')}
                        {(summaryByEdge.left?.enabled ?? true) && renderEdge('left', 0, currentMaxDepth - currentDepthLeft, 'S')}
                        {(summaryByEdge.right?.enabled ?? true) && renderEdge('right', currentWidth, currentMaxDepth - currentDepthRight, 'S')}

                        {(includeBack && (summaryByEdge.back?.enabled ?? true)) ? (
                            renderEdge('back', 0, 0, 'E')
                        ) : (
                            <g>
                                <line
                                    x1={-500}
                                    y1={0}
                                    x2={currentWidth + 500}
                                    y2={0}
                                    stroke="rgba(203,213,225,0.55)"
                                    strokeWidth="40"
                                    strokeDasharray="180 120"
                                />
                                <text
                                    x={currentWidth / 2}
                                    y={-120}
                                    fill="rgba(148,163,184,0.9)"
                                    fontSize="190"
                                    fontFamily="Inter, sans-serif"
                                    textAnchor="middle"
                                    fontWeight="700"
                                >
                                    Befintlig vägg / fasad
                                </text>
                            </g>
                        )}

                        {renderFiestaItems('below')}
                        {renderParasols()}
                        {renderFiestaItems('above')}
                    </g>

                    {/* Suggestion Preview Overlay layer */}
                    {isShowingPreview && hoverPreviewLayout && (
                        <>
                            {/* Proposed boundary polygon overlay */}
                            <polygon
                                points={`0,${Math.max(hoverPreviewLayout.depthLeft, hoverPreviewLayout.depthRight)} ${hoverPreviewLayout.width},${Math.max(hoverPreviewLayout.depthLeft, hoverPreviewLayout.depthRight)} ${hoverPreviewLayout.width},${Math.max(hoverPreviewLayout.depthLeft, hoverPreviewLayout.depthRight) - hoverPreviewLayout.depthRight} 0,${Math.max(hoverPreviewLayout.depthLeft, hoverPreviewLayout.depthRight) - hoverPreviewLayout.depthLeft}`}
                                fill="rgba(249,115,22,0.06)"
                                stroke="#f97316"
                                strokeWidth="20"
                                strokeDasharray="50 35"
                                filter="url(#orangeGlow)"
                            />

                            {/* Proposed edges rendering */}
                            {renderProposedEdge('front', 0, Math.max(hoverPreviewLayout.depthLeft, hoverPreviewLayout.depthRight), 'E', hoverPreviewLayout)}
                            {(hoverPreviewLayout.edgeSummaries?.left?.enabled ?? true) && renderProposedEdge('left', 0, Math.max(hoverPreviewLayout.depthLeft, hoverPreviewLayout.depthRight) - hoverPreviewLayout.depthLeft, 'S', hoverPreviewLayout)}
                            {(hoverPreviewLayout.edgeSummaries?.right?.enabled ?? true) && renderProposedEdge('right', hoverPreviewLayout.width, Math.max(hoverPreviewLayout.depthLeft, hoverPreviewLayout.depthRight) - hoverPreviewLayout.depthRight, 'S', hoverPreviewLayout)}
                            {(hoverPreviewLayout.includeBack && (hoverPreviewLayout.edgeSummaries?.back?.enabled ?? true)) && renderProposedEdge('back', 0, 0, 'E', hoverPreviewLayout)}
                        </>
                    )}

                    {renderDimensions()}

                    {/* CAD Snap guidelines */}
                    {snapLines && snapLines.x !== null && (
                        <line
                            x1={snapLines.x}
                            y1={-padding}
                            x2={snapLines.x}
                            y2={currentMaxDepth + padding}
                            stroke="#f97316"
                            strokeWidth="15"
                            strokeDasharray="40 25"
                            filter="url(#orangeGlow)"
                        />
                    )}
                    {snapLines && snapLines.y !== null && (
                        <line
                            x1={-padding}
                            y1={snapLines.y}
                            x2={currentWidth + padding}
                            y2={snapLines.y}
                            stroke="#f97316"
                            strokeWidth="15"
                            strokeDasharray="40 25"
                            filter="url(#orangeGlow)"
                        />
                    )}

                    {activeMode === 'clickitup' && (
                        <>
                            <DragHandle x={currentWidth / 2} y={currentMaxDepth} edgeId="front" cursor="ns-resize" />
                            <DragHandle
                                x={0}
                                y={currentMaxDepth - currentDepthLeft + currentDepthLeft / 2}
                                edgeId={equalDepth ? "left" : "depthLeft"}
                                cursor={equalDepth ? "ew-resize" : "ns-resize"}
                            />
                            <DragHandle
                                x={currentWidth}
                                y={currentMaxDepth - currentDepthRight + currentDepthRight / 2}
                                edgeId={equalDepth ? "right" : "depthRight"}
                                cursor={equalDepth ? "ew-resize" : "ns-resize"}
                            />
                        </>
                    )}

                    {renderSegmentToolbar()}
                </svg>

                {/* Floating Undo/Redo capsule */}
                <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-[#12121a]/85 backdrop-blur-md border border-panel-border/80 rounded-full p-1.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.55)]">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={!canUndo}
                        className={`p-2 rounded-full transition-all duration-200 ${canUndo ? 'text-primary hover:bg-white/10 hover:text-white active:scale-95' : 'text-slate-600 cursor-not-allowed opacity-50'}`}
                        title="Ångra (Ctrl+Z)"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                    </button>
                    <div className="w-[1px] h-5 bg-panel-border/60" />
                    <button
                        type="button"
                        onClick={redo}
                        disabled={!canRedo}
                        className={`p-2 rounded-full transition-all duration-200 ${canRedo ? 'text-primary hover:bg-white/10 hover:text-white active:scale-95' : 'text-slate-600 cursor-not-allowed opacity-50'}`}
                        title="Gör om (Ctrl+Y)"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

