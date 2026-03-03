import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { DOOR_LABEL, MIN_DIMENSION_MM, STEP_MM } from '../../utils/sectionCalculator';

const DEFAULT_CAMERA = { zoom: 1, panX: 0, panY: 0 };

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function parseDoorSize(item) {
    const match = new RegExp(`${DOOR_LABEL}\\s+(\\d+)`, 'i').exec(String(item));
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function snapToGrid(value) {
    return Math.round(value / STEP_MM) * STEP_MM;
}

function normalizeCamera(camera, width, depth, padding) {
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

function sectionSegmentsFromArray(sections, edgeKey) {
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
    includeBack,
    leftEdge,
    rightEdge,
    frontEdge,
    backEdge,
    edgeDiagnostics = {},
    edgeSummaries = {},
    layoutWarnings = [],
    suggestions = [],
    camera = DEFAULT_CAMERA,
    selection,
    interactionMode = 'select',
    uiDensity = 'desktop',
    onResize,
    onSelectEdge,
    onApplySuggestion,
    onCameraChange
}) {
    const svgRef = useRef(null);
    const [activeDrag, setActiveDrag] = useState(null);
    const dragRef = useRef({ startX: 0, startY: 0, initialW: 0, initialD: 0 });
    const panRef = useRef(null);
    const touchRef = useRef({ pinch: null, singlePan: null });

    const padding = uiDensity === 'touch' ? 2000 : 1500;
    const activeCamera = useMemo(
        () => normalizeCamera(camera, width, depth, padding),
        [camera, width, depth, padding]
    );

    const totalWidth = width + padding * 2;
    const totalHeight = depth + padding * 2;
    const viewWidth = totalWidth / activeCamera.zoom;
    const viewHeight = totalHeight / activeCamera.zoom;
    const viewBox = `${activeCamera.panX} ${activeCamera.panY} ${viewWidth} ${viewHeight}`;

    const handleSize = uiDensity === 'touch' ? 150 : 110;
    const handleHit = uiDensity === 'touch' ? 600 : 420;
    const sectionThickness = uiDensity === 'touch' ? 130 : 100;
    const labelFont = uiDensity === 'touch' ? 220 : 190;

    const summaryByEdge = useMemo(
        () => ({
            front: edgeSummaries.front || { segments: sectionSegmentsFromArray(frontEdge, 'front') },
            left: edgeSummaries.left || { segments: sectionSegmentsFromArray(leftEdge, 'left') },
            right: edgeSummaries.right || { segments: sectionSegmentsFromArray(rightEdge, 'right') },
            back: edgeSummaries.back || { segments: sectionSegmentsFromArray(backEdge, 'back') }
        }),
        [edgeSummaries, frontEdge, leftEdge, rightEdge, backEdge]
    );

    const selectedEdge = selection?.edgeKey || null;
    const selectedEdgeSuggestions = useMemo(
        () => suggestions.filter((suggestion) => suggestion.edge === selectedEdge),
        [suggestions, selectedEdge]
    );

    const criticalWarnings = useMemo(
        () => layoutWarnings.filter((warning) => warning.level === 'critical'),
        [layoutWarnings]
    );

    const emitCamera = useCallback(
        (nextCamera) => {
            const normalized = normalizeCamera(nextCamera, width, depth, padding);
            onCameraChange?.(normalized);
        },
        [onCameraChange, width, depth, padding]
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

    const beginResize = useCallback(
        (edgeId, event) => {
            if (interactionMode !== 'resize') return;
            event.preventDefault();
            event.stopPropagation();
            dragRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                initialW: width,
                initialD: depth
            };
            setActiveDrag(edgeId);
        },
        [depth, interactionMode, width]
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
                const newDepth = Math.max(MIN_DIMENSION_MM, snapToGrid(dragRef.current.initialD + deltaY));
                onResize?.({ depth: newDepth });
            } else if (activeDrag === 'right') {
                const newWidth = Math.max(MIN_DIMENSION_MM, snapToGrid(dragRef.current.initialW + deltaX));
                onResize?.({ width: newWidth });
            } else if (activeDrag === 'left') {
                const newWidth = Math.max(MIN_DIMENSION_MM, snapToGrid(dragRef.current.initialW - deltaX));
                onResize?.({ width: newWidth });
            }
        };

        const handleUp = () => setActiveDrag(null);

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [activeDrag, onResize, viewHeight, viewWidth]);

    const startPan = useCallback(
        (event) => {
            if (interactionMode !== 'pan') return;
            if (event.button !== 0 && event.button !== 1) return;
            event.preventDefault();

            panRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                panX: activeCamera.panX,
                panY: activeCamera.panY
            };
        },
        [activeCamera.panX, activeCamera.panY, interactionMode]
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
            if (interactionMode !== 'pan') return;
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
        [activeCamera, interactionMode]
    );

    const handleTouchMove = useCallback(
        (event) => {
            if (interactionMode !== 'pan') return;
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
        [emitCamera, interactionMode, totalHeight, totalWidth, viewHeight, viewWidth]
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

    const renderSegment = (edgeKey, segment, geometry, isSelectedEdge) => {
        const fill = segment.isDoor
            ? 'rgba(16,185,129,0.30)'
            : isSelectedEdge
                ? 'rgba(59,130,246,0.30)'
                : 'rgba(56,189,248,0.20)';

        const stroke = segment.isDoor
            ? 'rgba(16,185,129,0.9)'
            : isSelectedEdge
                ? 'rgba(59,130,246,0.95)'
                : 'rgba(148,163,184,0.65)';

        return (
            <g
                key={segment.key}
                style={{ cursor: interactionMode === 'select' ? 'pointer' : 'default' }}
                onClick={() => interactionMode === 'select' && onSelectEdge?.(edgeKey)}
            >
                <rect
                    x={geometry.x}
                    y={geometry.y}
                    width={geometry.w}
                    height={geometry.h}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelectedEdge ? 28 : 20}
                    rx="18"
                />
                <text
                    x={geometry.tx}
                    y={geometry.ty}
                    fill={isSelectedEdge ? '#ffffff' : '#e2e8f0'}
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

    const renderEdge = (edgeKey, startX, startY, direction) => {
        const summary = summaryByEdge[edgeKey] || { segments: [] };
        const segments = summary.segments || [];
        const diagnostics = edgeDiagnostics[edgeKey];
        const isInvalid = diagnostics?.valid === false;
        const isSelected = selectedEdge === edgeKey;
        const objects = [];

        let cx = startX;
        let cy = startY;

        objects.push(
            <circle
                key={`post-start-${edgeKey}`}
                cx={cx}
                cy={cy}
                r={sectionThickness * 0.9}
                fill={isInvalid ? 'rgba(239,68,68,0.35)' : 'rgba(15,23,42,0.9)'}
                stroke={isSelected ? '#3b82f6' : 'rgba(148,163,184,0.4)'}
                strokeWidth={isSelected ? 34 : 24}
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

            objects.push(renderSegment(edgeKey, segment, geometry, isSelected));

            if (direction === 'E') {
                cx += len;
            } else {
                cy += len;
            }

            objects.push(
                <circle
                    key={`post-${edgeKey}-${segment.key}`}
                    cx={cx}
                    cy={cy}
                    r={sectionThickness * 0.9}
                    fill={isInvalid ? 'rgba(239,68,68,0.35)' : 'rgba(15,23,42,0.9)'}
                    stroke={isSelected ? '#3b82f6' : 'rgba(148,163,184,0.4)'}
                    strokeWidth={isSelected ? 34 : 24}
                />
            );
        });

        if (isInvalid) {
            const tx = direction === 'E' ? startX + (edgeKey === 'front' || edgeKey === 'back' ? width / 2 : 550) : startX - 400;
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

    const renderDimensions = () => (
        <>
            <line x1={0} y1={depth + 360} x2={width} y2={depth + 360} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
            <line x1={0} y1={depth + 280} x2={0} y2={depth + 440} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
            <line x1={width} y1={depth + 280} x2={width} y2={depth + 440} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
            <text
                x={width / 2}
                y={depth + 560}
                fill="#cbd5e1"
                fontSize="180"
                textAnchor="middle"
                fontWeight="700"
                fontFamily="Inter, sans-serif"
            >
                {width} mm
            </text>

            <line x1={width + 360} y1={0} x2={width + 360} y2={depth} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
            <line x1={width + 280} y1={0} x2={width + 440} y2={0} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
            <line x1={width + 280} y1={depth} x2={width + 440} y2={depth} stroke="rgba(148,163,184,0.8)" strokeWidth="18" />
            <text
                x={width + 560}
                y={depth / 2}
                fill="#cbd5e1"
                fontSize="180"
                fontWeight="700"
                fontFamily="Inter, sans-serif"
                transform={`rotate(90 ${width + 560} ${depth / 2})`}
                textAnchor="middle"
            >
                {depth} mm
            </text>
        </>
    );

    const DragHandle = ({ x, y, edgeId, cursor }) => (
        <g
            style={{ cursor: interactionMode === 'resize' ? cursor : 'default', pointerEvents: 'all' }}
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
                opacity={interactionMode === 'resize' ? 1 : 0.35}
            />
        </g>
    );

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="text-text-secondary">
                    Zoom: <b className="text-text-primary">{activeCamera.zoom.toFixed(2)}x</b>
                </div>
                <div className="text-text-secondary">
                    Aktiv kant: <b className="text-text-primary">{selectedEdge || 'Ingen'}</b>
                </div>
                <div className="text-text-secondary">
                    Kritiska varningar: <b className="text-text-primary">{criticalWarnings.length}</b>
                </div>
            </div>

            <svg
                ref={svgRef}
                viewBox={viewBox}
                className="w-full h-auto border border-panel-border rounded-lg bg-[#0b1220]"
                style={{ minHeight: '500px', maxHeight: '760px', touchAction: interactionMode === 'pan' ? 'none' : 'manipulation' }}
                onWheel={handleWheel}
                onMouseDown={startPan}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {renderGrid()}
                <line x1={-padding} y1={0} x2={width + padding} y2={0} stroke="rgba(30,64,175,0.4)" strokeWidth="18" />
                <line x1={0} y1={-padding} x2={0} y2={depth + padding} stroke="rgba(30,64,175,0.4)" strokeWidth="18" />

                <rect
                    x={0}
                    y={0}
                    width={width}
                    height={depth}
                    fill="rgba(15,23,42,0.22)"
                    stroke="rgba(59,130,246,0.55)"
                    strokeWidth="26"
                    strokeDasharray="100 70"
                />

                {renderEdge('front', 0, depth, 'E')}
                {renderEdge('left', 0, 0, 'S')}
                {renderEdge('right', width, 0, 'S')}

                {includeBack ? (
                    renderEdge('back', 0, 0, 'E')
                ) : (
                    <>
                        <line
                            x1={-500}
                            y1={0}
                            x2={width + 500}
                            y2={0}
                            stroke="rgba(203,213,225,0.55)"
                            strokeWidth="40"
                            strokeDasharray="180 120"
                        />
                        <text
                            x={width / 2}
                            y={-120}
                            fill="rgba(148,163,184,0.9)"
                            fontSize="190"
                            fontFamily="Inter, sans-serif"
                            textAnchor="middle"
                            fontWeight="700"
                        >
                            Befintlig vägg / fasad
                        </text>
                    </>
                )}

                {renderDimensions()}

                <DragHandle x={width / 2} y={depth} edgeId="front" cursor="ns-resize" />
                <DragHandle x={0} y={depth / 2} edgeId="left" cursor="ew-resize" />
                <DragHandle x={width} y={depth / 2} edgeId="right" cursor="ew-resize" />
            </svg>

            {selectedEdgeSuggestions.length > 0 && (
                <div className="bg-input-bg border border-panel-border rounded-lg p-3">
                    <p className="text-xs uppercase font-semibold text-text-secondary m-0 mb-2">Förslag för vald kant</p>
                    <div className="flex flex-wrap gap-2">
                        {selectedEdgeSuggestions.slice(0, 4).map((suggestion) => (
                            <button
                                key={suggestion.id}
                                onClick={() => onApplySuggestion?.(suggestion.id)}
                                className="px-3 py-1.5 rounded-md text-xs border border-panel-border bg-panel-bg text-text-primary hover:bg-white/5"
                            >
                                {suggestion.text}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
