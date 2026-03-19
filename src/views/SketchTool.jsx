import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import {
    computeLayout,
    DOOR_LABEL,
    DOOR_SIZES,
    MIN_DIMENSION_MM,
    SECTION_SIZES,
    STEP_MM
} from '../utils/sectionCalculator';
import {
    DEFAULT_PARASOL_PRESET_ID,
    FIESTA_DIAMETER_MM,
    FIESTA_DEFAULT_LAYER,
    FIESTA_EXPORT_LINE,
    FIESTA_EXPORT_MODEL,
    FIESTA_EXPORT_SIZE,
    getParasolPresetById,
    normalizeFiestaItem,
    isParasolRotatable,
    getAreaPolygon,
    pointInPolygon,
    snapToStep100,
    computeParasolOverlapWarnings
} from '../utils/parasolGeometry';
import { downloadBlob, saveBlobWithPicker } from '../utils/fileUtils';
import { buildSketchExportState } from '../features/sketchExportState.js';
import { SketchCanvas } from '../components/features/SketchCanvas';
import { SketchConfig } from '../components/features/SketchConfig';
import { SketchBom } from '../components/features/SketchBom';
import { StockComparisonModal } from '../components/features/StockComparisonModal';
import toast from 'react-hot-toast';
import { safeLogActivity } from '../services/activityLogService';

const EDGE_LABELS = {
    front: 'Fram',
    left: 'Vänster',
    right: 'Höger',
    back: 'Bak'
};

const EDGE_KEYS = ['front', 'left', 'right', 'back'];
const DEFAULT_CAMERA = { zoom: 1, panX: 0, panY: 0 };

function roundToStep(value) {
    return Math.round(value / STEP_MM) * STEP_MM;
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function nearestFromList(value, list) {
    return list.reduce((best, current) => {
        const bestDiff = Math.abs(best - value);
        const currentDiff = Math.abs(current - value);
        if (currentDiff < bestDiff) return current;
        if (currentDiff === bestDiff && current > best) return current;
        return best;
    }, list[0]);
}

function normalizeDimension(rawValue, fallback) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, MIN_DIMENSION_MM, 50000);
}

function normalizeDepth(rawValue, fallback) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, 0, 50000);
}

function normalizeTarget(rawValue, fallback) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return nearestFromList(clamp(rounded, 700, 2000), SECTION_SIZES);
}

function normalizeDoorSize(rawValue) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : 1000;
    return nearestFromList(base, DOOR_SIZES);
}

function normalizeDoorSegment(rawSegment, fallbackIndex = 0) {
    const parsedIndex = Number(rawSegment?.index);
    const normalizedIndex = Number.isInteger(parsedIndex) && parsedIndex >= 0 ? parsedIndex : fallbackIndex;
    return {
        index: normalizedIndex,
        size: normalizeDoorSize(rawSegment?.size)
    };
}

function normalizeDoorSegments(rawSegments = []) {
    if (!Array.isArray(rawSegments)) return [];

    const byIndex = new Map();
    rawSegments.forEach((segment, position) => {
        const normalized = normalizeDoorSegment(segment, position);
        byIndex.set(normalized.index, normalized);
    });

    return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

function normalizeDoorSegmentsByEdge(config, includeBack, hasLeftDepth, hasRightDepth) {
    const rawDoorSegmentsByEdge = config.doorSegmentsByEdge;
    const hasNewModel = rawDoorSegmentsByEdge && typeof rawDoorSegmentsByEdge === 'object' && !Array.isArray(rawDoorSegmentsByEdge);
    const normalized = {};

    if (hasNewModel) {
        EDGE_KEYS.forEach((edge) => {
            if (edge === 'back' && !includeBack) return;
            if (edge === 'left' && !hasLeftDepth) return;
            if (edge === 'right' && !hasRightDepth) return;
            const segments = normalizeDoorSegments(rawDoorSegmentsByEdge[edge]);
            if (segments.length > 0) {
                normalized[edge] = segments;
            }
        });
        return normalized;
    }

    const rawDoorEdges = config.doorEdges;
    const normalizedDoorEdges = rawDoorEdges instanceof Set
        ? [...rawDoorEdges]
        : Array.isArray(rawDoorEdges)
            ? rawDoorEdges
            : [];
    const doors = new Set(normalizedDoorEdges);
    if (!includeBack) doors.delete('back');
    if (!hasLeftDepth) doors.delete('left');
    if (!hasRightDepth) doors.delete('right');

    const sourceDoorSizes = config.doorSizeByEdge || {};
    doors.forEach((edge) => {
        normalized[edge] = [{
            index: 0,
            size: normalizeDoorSize(sourceDoorSizes[edge] ?? 1000)
        }];
    });

    return normalized;
}

function normalizeManualSectionsByEdge(rawManualSectionsByEdge, doorSegmentsByEdge) {
    const normalized = {};

    EDGE_KEYS.forEach((edge) => {
        const rawPins = Array.isArray(rawManualSectionsByEdge?.[edge]) ? rawManualSectionsByEdge[edge] : [];
        const blockedIndexes = new Set((doorSegmentsByEdge[edge] || []).map((segment) => segment.index));
        const byIndex = new Map();

        rawPins.forEach((pin) => {
            const parsedIndex = Number(pin?.index);
            if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || blockedIndexes.has(parsedIndex)) {
                return;
            }
            byIndex.set(parsedIndex, {
                index: parsedIndex,
                size: nearestFromList(clamp(Number(pin?.size) || 1600, 700, 2000), SECTION_SIZES)
            });
        });

        const pins = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
        if (pins.length > 0) {
            normalized[edge] = pins;
        }
    });

    return normalized;
}

function normalizeParasol(parasol) {
    if (!parasol) return parasol;

    return {
        ...parasol,
        rotationDeg: parasol.rotationDeg === 90 ? 90 : 0
    };
}

function normalizeFiesta(fiesta) {
    return normalizeFiestaItem(fiesta);
}

function sanitizeConfig(config) {
    const next = { ...config };
    next.width = normalizeDimension(next.width, 8000);
    next.equalDepth = next.equalDepth !== false; // default true

    const primaryDepth = normalizeDepth(next.depth ?? next.depthLeft ?? next.depthRight, 4000);
    const normalizedDepthLeft = normalizeDepth(next.depthLeft, primaryDepth);
    const normalizedDepthRight = normalizeDepth(next.depthRight, primaryDepth);

    if (next.equalDepth) {
        const sharedDepth = primaryDepth;
        next.depth = sharedDepth;
        next.depthLeft = sharedDepth;
        next.depthRight = sharedDepth;
    } else {
        next.depthLeft = normalizedDepthLeft;
        next.depthRight = normalizedDepthRight;
        next.depth = Math.max(normalizedDepthLeft, normalizedDepthRight); // keep for backwards compat
    }

    next.targetLength = normalizeTarget(next.targetLength, 1500);
    next.includeBack = !!next.includeBack;
    const hasLeftDepth = next.depthLeft > 0;
    const hasRightDepth = next.depthRight > 0;
    const hasAnySideDepth = hasLeftDepth || hasRightDepth;
    if (!hasAnySideDepth) {
        next.includeBack = false;
    }
    next.prioMode = ['symmetrical', 'convenient', 'target'].includes(next.prioMode) ? next.prioMode : 'symmetrical';

    next.doorSegmentsByEdge = normalizeDoorSegmentsByEdge(next, next.includeBack, hasLeftDepth, hasRightDepth);
    next.manualSectionsByEdge = normalizeManualSectionsByEdge(config.manualSectionsByEdge, next.doorSegmentsByEdge);
    delete next.doorEdges;
    delete next.doorSizeByEdge;
    next.activeMode = config.activeMode || 'clickitup';
    next.parasols = Array.isArray(config.parasols)
        ? config.parasols.map(normalizeParasol).filter(Boolean)
        : [];
    next.selectedParasolId = config.selectedParasolId || null;
    next.selectedParasolPresetId = getParasolPresetById(config.selectedParasolPresetId)
        ? config.selectedParasolPresetId
        : DEFAULT_PARASOL_PRESET_ID;
    next.fiestaItems = Array.isArray(config.fiestaItems)
        ? config.fiestaItems.map(normalizeFiesta).filter(Boolean)
        : [];
    next.selectedFiestaId = (config.selectedFiestaId && next.fiestaItems.some((fiesta) => fiesta.id === config.selectedFiestaId))
        ? config.selectedFiestaId
        : null;
    return next;
}

function parseDoorSize(section) {
    const match = new RegExp(`${DOOR_LABEL}\\s+(\\d+)`, 'i').exec(String(section));
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function getInitialDensity() {
    if (typeof window === 'undefined') {
        return 'desktop';
    }
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return coarse ? 'touch' : 'desktop';
}

function serializeSketchConfig(config) {
    const { doorEdges, doorSizeByEdge, ...rest } = config || {};
    return {
        ...rest
    };
}

function createDefaultSketchConfig() {
    return {
        width: 8000,
        depth: 4000,
        depthLeft: 4000,
        depthRight: 4000,
        equalDepth: true,
        includeBack: false,
        prioMode: 'symmetrical',
        targetLength: 1500,
        doorSegmentsByEdge: {},
        manualSectionsByEdge: {},
        activeMode: 'clickitup',
        parasols: [],
        selectedParasolId: null,
        selectedParasolPresetId: DEFAULT_PARASOL_PRESET_ID,
        fiestaItems: [],
        selectedFiestaId: null
    };
}

function cloneSketchConfig(config) {
    return sanitizeConfig(JSON.parse(JSON.stringify(config || createDefaultSketchConfig())));
}

function cloneWorkspace(saved = {}) {
    return {
        camera: { ...DEFAULT_CAMERA, ...(saved.camera || {}) },
        selection: {
            edgeKey: saved.selection?.edgeKey || 'front',
            segmentIndex: saved.selection?.segmentIndex ?? null
        },
        uiDensity: saved.uiDensity || getInitialDensity()
    };
}

function warnIfActivityLogFailed(result, message) {
    if (result?.ok === false) {
        toast(message, { icon: '!' });
    }
}

export function SketchTool({ onBack }) {
    const { state, dispatch } = useQuote();
    const { user, canExportSketchToQuote } = useAuth();

    const initialConfigRef = useRef(cloneSketchConfig(state.sketchDraft?.config || createDefaultSketchConfig()));
    const initialWorkspaceRef = useRef(cloneWorkspace(state.sketchDraft?.workspace || {}));

    const [config, setConfig] = useState(() => cloneSketchConfig(initialConfigRef.current));
    const [workspace, setWorkspace] = useState(() => cloneWorkspace(initialWorkspaceRef.current));

    const [showStockModal, setShowStockModal] = useState(false);
    const [dragPreview, setDragPreview] = useState(null);

    const updateConfig = useCallback((partial) => {
        setConfig((prev) => {
            const merged = {
                ...prev,
                ...partial,
                doorSegmentsByEdge: Object.prototype.hasOwnProperty.call(partial, 'doorSegmentsByEdge')
                    ? partial.doorSegmentsByEdge
                    : prev.doorSegmentsByEdge,
                manualSectionsByEdge: Object.prototype.hasOwnProperty.call(partial, 'manualSectionsByEdge')
                    ? partial.manualSectionsByEdge
                    : prev.manualSectionsByEdge
            };
            return sanitizeConfig(merged);
        });
    }, []);

    const setManualPin = useCallback((edgeKey, segmentIndex, size) => {
        const nextPins = { ...(config.manualSectionsByEdge || {}) };
        const currentPins = (nextPins[edgeKey] || []).filter((pin) => pin.index !== segmentIndex);
        if (size !== null) {
            currentPins.push({ index: segmentIndex, size });
            currentPins.sort((a, b) => a.index - b.index);
        }
        if (currentPins.length > 0) {
            nextPins[edgeKey] = currentPins;
        } else {
            delete nextPins[edgeKey];
        }

        const nextDoors = { ...(config.doorSegmentsByEdge || {}) };
        const filteredDoors = (nextDoors[edgeKey] || []).filter((segment) => segment.index !== segmentIndex);
        if (filteredDoors.length > 0) {
            nextDoors[edgeKey] = filteredDoors;
        } else {
            delete nextDoors[edgeKey];
        }

        updateConfig({
            manualSectionsByEdge: nextPins,
            doorSegmentsByEdge: nextDoors
        });
    }, [config.doorSegmentsByEdge, config.manualSectionsByEdge, updateConfig]);

    const clearManualPins = useCallback((edgeKey) => {
        const next = { ...(config.manualSectionsByEdge || {}) };
        delete next[edgeKey];
        updateConfig({ manualSectionsByEdge: next });
    }, [config.manualSectionsByEdge, updateConfig]);

    const setDoorSegmentSize = useCallback((edgeKey, segmentIndex, size) => {
        const nextDoors = { ...(config.doorSegmentsByEdge || {}) };
        const current = (nextDoors[edgeKey] || []).filter((segment) => segment.index !== segmentIndex);
        current.push({ index: segmentIndex, size: normalizeDoorSize(size) });
        current.sort((a, b) => a.index - b.index);
        nextDoors[edgeKey] = current;

        const nextPins = { ...(config.manualSectionsByEdge || {}) };
        const filteredPins = (nextPins[edgeKey] || []).filter((pin) => pin.index !== segmentIndex);
        if (filteredPins.length > 0) {
            nextPins[edgeKey] = filteredPins;
        } else {
            delete nextPins[edgeKey];
        }

        updateConfig({
            doorSegmentsByEdge: nextDoors,
            manualSectionsByEdge: nextPins
        });
    }, [config.doorSegmentsByEdge, config.manualSectionsByEdge, updateConfig]);

    const resetDoorSegment = useCallback((edgeKey, segmentIndex) => {
        const nextDoors = { ...(config.doorSegmentsByEdge || {}) };
        const filteredDoors = (nextDoors[edgeKey] || []).filter((segment) => segment.index !== segmentIndex);
        if (filteredDoors.length > 0) {
            nextDoors[edgeKey] = filteredDoors;
        } else {
            delete nextDoors[edgeKey];
        }
        updateConfig({ doorSegmentsByEdge: nextDoors });
    }, [config.doorSegmentsByEdge, updateConfig]);

    const layout = useMemo(() => computeLayout(config), [config]);
    const previewConfig = useMemo(() => {
        if (!dragPreview) return config;
        return sanitizeConfig({
            ...config,
            ...dragPreview,
            doorSegmentsByEdge: config.doorSegmentsByEdge,
            manualSectionsByEdge: config.manualSectionsByEdge
        });
    }, [config, dragPreview]);
    const previewLayout = useMemo(
        () => (dragPreview ? computeLayout(previewConfig) : layout),
        [dragPreview, previewConfig, layout]
    );

    const invalidEdges = useMemo(
        () => Object.entries(layout.edgeDiagnostics || {}).filter(([, diag]) => !diag.valid),
        [layout.edgeDiagnostics]
    );

    const autoAdjustedEdges = useMemo(
        () => Object.entries(layout.edgeDiagnostics || {}).filter(([, diag]) => diag.valid && diag.autoAdjusted),
        [layout.edgeDiagnostics]
    );

    const criticalWarnings = useMemo(
        () => (layout.layoutWarnings || []).filter((warning) => warning.level === 'critical'),
        [layout.layoutWarnings]
    );

    const warningWarnings = useMemo(
        () => (layout.layoutWarnings || []).filter((warning) => warning.level === 'warning'),
        [layout.layoutWarnings]
    );

    const canExport = layout.allSections.length > 0 || (config.parasols || []).length > 0 || (config.fiestaItems || []).length > 0;

    const handleResizePreview = useCallback((dims) => {
        if (!dims || Object.keys(dims).length === 0) {
            setDragPreview(null);
            return;
        }

        setDragPreview((prev) => {
            const base = prev || {};
            const merged = { ...base, ...dims };
            const changed = Object.entries(dims).some(([key, value]) => base[key] !== value);
            return changed ? merged : base;
        });
    }, []);

    const handleResizeCommit = useCallback(
        (dims) => {
            setDragPreview(null);
            if (dims && Object.keys(dims).length > 0) {
                updateConfig(dims);
            }
        },
        [updateConfig]
    );

    const handleSelectEdge = useCallback((edgeKey) => {
        setWorkspace((prev) => ({
            ...prev,
            selection: { ...prev.selection, edgeKey }
        }));
    }, []);

    const handleCameraChange = useCallback((camera) => {
        setWorkspace((prev) => ({
            ...prev,
            camera
        }));
    }, []);
    const resetSketch = useCallback(() => {
        setDragPreview(null);
        setShowStockModal(false);
        setConfig(cloneSketchConfig(initialConfigRef.current));
        setWorkspace(cloneWorkspace(initialWorkspaceRef.current));
    }, []);

    const applySuggestion = useCallback(
        (suggestionId) => {
            const suggestion = (layout.suggestions || []).find((entry) => entry.id === suggestionId);
            if (!suggestion) return;

            if (suggestion.type === 'setDoorSegmentSize') {
                setDoorSegmentSize(suggestion.edge, suggestion.index ?? 0, suggestion.value);
            } else if (suggestion.type === 'removeDoorSegment') {
                resetDoorSegment(suggestion.edge, suggestion.index ?? 0);
            } else if (suggestion.type === 'setDimension') {
                let nextDimensionUpdate = { [suggestion.dimension]: suggestion.value };
                if (suggestion.dimension === 'depth') {
                    nextDimensionUpdate = config.equalDepth
                        ? { depth: suggestion.value }
                        : suggestion.edge === 'left'
                            ? { depthLeft: suggestion.value }
                            : suggestion.edge === 'right'
                                ? { depthRight: suggestion.value }
                                : { depth: suggestion.value };
                }
                updateConfig(nextDimensionUpdate);
            }

            setWorkspace((prev) => ({
                ...prev,
                selection: { ...prev.selection, edgeKey: suggestion.edge }
            }));

            toast.success('Förslag applicerat.');
        },
        [config.equalDepth, layout.suggestions, resetDoorSegment, setDoorSegmentSize, updateConfig]
    );

    const parasolWarnings = useMemo(
        () => computeParasolOverlapWarnings(config.parasols || []),
        [config.parasols]
    );

    const parasolAreaPolygon = useMemo(
        () => getAreaPolygon(config),
        [config.width, config.depth, config.depthLeft, config.depthRight, config.equalDepth]
    );

    const handleChangeMode = useCallback((mode) => {
        updateConfig({
            activeMode: mode,
            selectedParasolId: mode === 'parasol' ? config.selectedParasolId : null,
            selectedFiestaId: mode === 'fiesta' ? config.selectedFiestaId : null
        });
    }, [config.selectedFiestaId, config.selectedParasolId, updateConfig]);

    const handlePlaceParasol = useCallback((xMm, yMm) => {
        if (config.activeMode !== 'parasol') return;
        const preset = getParasolPresetById(config.selectedParasolPresetId);
        if (!preset) return;

        const snappedX = snapToStep100(xMm);
        const snappedY = snapToStep100(yMm);

        if (!pointInPolygon(snappedX, snappedY, parasolAreaPolygon)) {
            toast.error('Parasollens centrum måste vara inom ytan.');
            return;
        }

        const newId = `parasol-${Date.now()}`;
        const newParasol = {
            id: newId,
            presetId: preset.id,
            label: preset.label,
            widthMm: preset.widthMm,
            depthMm: preset.depthMm,
            rotationDeg: 0,
            xMm: snappedX,
            yMm: snappedY,
            exportLine: preset.exportLine,
            exportModel: preset.exportModel,
            exportSize: preset.exportSize
        };

        updateConfig({
            parasols: [...(config.parasols || []), newParasol],
            selectedParasolId: newId
        });
    }, [config.activeMode, config.selectedParasolPresetId, config.parasols, parasolAreaPolygon, updateConfig]);

    const handleSelectParasol = useCallback((id) => {
        updateConfig({ selectedParasolId: id });
    }, [updateConfig]);

    const handleMoveParasol = useCallback((id, xMm, yMm) => {
        const snappedX = snapToStep100(xMm);
        const snappedY = Math.max(0, snapToStep100(yMm));

        if (!pointInPolygon(snappedX, snappedY, parasolAreaPolygon)) {
            return; // Don't allow drag outside
        }

        updateConfig({
            parasols: (config.parasols || []).map(p =>
                p.id === id ? { ...p, xMm: snappedX, yMm: snappedY } : p
            )
        });
    }, [config.parasols, parasolAreaPolygon, updateConfig]);

    const handleRotateParasol = useCallback((id, rotationDeg) => {
        updateConfig({
            parasols: (config.parasols || []).map((parasol) => {
                if (parasol.id !== id) return parasol;
                if (!isParasolRotatable(parasol)) return parasol;
                return {
                    ...parasol,
                    rotationDeg: rotationDeg === 90 ? 90 : 0
                };
            })
        });
    }, [config.parasols, updateConfig]);

    const handleDeleteParasol = useCallback((id) => {
        updateConfig({
            parasols: (config.parasols || []).filter(p => p.id !== id),
            selectedParasolId: config.selectedParasolId === id ? null : config.selectedParasolId
        });
    }, [config.parasols, config.selectedParasolId, updateConfig]);

    const handlePlaceFiesta = useCallback((xMm, yMm) => {
        if (config.activeMode !== 'fiesta') return;

        const snappedX = snapToStep100(xMm);
        const snappedY = snapToStep100(yMm);

        if (!pointInPolygon(snappedX, snappedY, parasolAreaPolygon)) {
            toast.error('Fiestas centrum måste vara inom ytan.');
            return;
        }

        const newId = `fiesta-${Date.now()}`;
        const newFiesta = {
            id: newId,
            diameterMm: FIESTA_DIAMETER_MM,
            xMm: snappedX,
            yMm: snappedY,
            zLayer: FIESTA_DEFAULT_LAYER,
            exportLine: FIESTA_EXPORT_LINE,
            exportModel: FIESTA_EXPORT_MODEL,
            exportSize: FIESTA_EXPORT_SIZE
        };

        updateConfig({
            fiestaItems: [...(config.fiestaItems || []), newFiesta],
            selectedFiestaId: newId
        });
    }, [config.activeMode, config.fiestaItems, parasolAreaPolygon, updateConfig]);

    const handleSelectFiesta = useCallback((id) => {
        updateConfig({ selectedFiestaId: id });
    }, [updateConfig]);

    const handleMoveFiesta = useCallback((id, xMm, yMm) => {
        const snappedX = snapToStep100(xMm);
        const snappedY = Math.max(0, snapToStep100(yMm));

        if (!pointInPolygon(snappedX, snappedY, parasolAreaPolygon)) {
            return;
        }

        updateConfig({
            fiestaItems: (config.fiestaItems || []).map((fiesta) =>
                fiesta.id === id ? { ...fiesta, xMm: snappedX, yMm: snappedY } : fiesta
            )
        });
    }, [config.fiestaItems, parasolAreaPolygon, updateConfig]);

    const handleDeleteFiesta = useCallback((id) => {
        updateConfig({
            fiestaItems: (config.fiestaItems || []).filter((fiesta) => fiesta.id !== id),
            selectedFiestaId: config.selectedFiestaId === id ? null : config.selectedFiestaId
        });
    }, [config.fiestaItems, config.selectedFiestaId, updateConfig]);

    const handleExportClick = () => {
        if (!canExportSketchToQuote) {
            toast.error('Du har inte behorighet att exportera till offert.');
            return;
        }

        if (!canExport) {
            toast.error('Ingen layout att exportera ännu.');
            return;
        }

        if (criticalWarnings.length > 0) {
            const warningText = criticalWarnings.map((warning) => `• ${warning.text}`).join('\n');
            const confirmed = window.confirm(
                `Layouten har kritiska varningar:\n\n${warningText}\n\nFortsätt export ändå?`
            );
            if (!confirmed) return;
        }

        setShowStockModal(true);
    };

    const commitExport = () => {
        if (!canExportSketchToQuote) {
            setShowStockModal(false);
            return;
        }

        setShowStockModal(false);

        const hasParasols = config.parasols && config.parasols.length > 0;
        const hasFiestaItems = config.fiestaItems && config.fiestaItems.length > 0;
        const nextSketchExportState = buildSketchExportState({
            selectedLines: state.selectedLines,
            builderItems: state.builderItems || [],
            globalDiscountPct: state.globalDiscountPct || 0,
            sketchMeta: state.sketchMeta || {},
            parasols: config.parasols || [],
            fiestaItems: config.fiestaItems || []
        });

        const gridSelections = { ...state.gridSelections };
        // Build from scratch so each export reflects only the current sketch.
        const cuGrid = { items: {}, addons: {} };

        layout.allSections.forEach((section) => {
            const doorSize = parseDoorSize(section);
            const key = doorSize ? `ClickitUp Dörr|${doorSize}` : `ClickitUp Sektion|${section}`;
            if (!cuGrid.items[key]) {
                cuGrid.items[key] = { qty: 0, discountPct: 0 };
            }
            cuGrid.items[key].qty += 1;
        });

        if (layout.slimlineCount > 0) {
            if (!cuGrid.addons.stodben_litet) {
                cuGrid.addons.stodben_litet = { qty: 0, discountPct: 0 };
            }
            cuGrid.addons.stodben_litet.qty += layout.slimlineCount;
        }

        if (layout.stodbenCount > 0) {
            if (!cuGrid.addons.stodben_stort) {
                cuGrid.addons.stodben_stort = { qty: 0, discountPct: 0 };
            }
            cuGrid.addons.stodben_stort.qty += layout.stodbenCount;
        }

        gridSelections.ClickitUP = cuGrid;

        dispatch({ type: 'SET_SELECTED_LINES', payload: nextSketchExportState.selectedLines });
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: gridSelections });
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: nextSketchExportState.builderItems });
        dispatch({
            type: 'UPDATE_STATE',
            payload: {
                sketchDraft: {
                    config: serializeSketchConfig(config),
                    workspace
                },
                sketchMeta: nextSketchExportState.sketchMeta
            }
        });
        dispatch({ type: 'SET_STEP', payload: 2 });
        void safeLogActivity({
            user,
            eventType: 'sketch_export_to_quote',
            system: 'sketch',
            targetType: state.activeQuoteId ? 'quote' : 'draft_quote',
            targetId: state.activeQuoteId || 'draft_quote',
            details: hasParasols
                ? `Ritning exporterad till offert med ${config.parasols.length} parasoller${hasFiestaItems ? ` och ${config.fiestaItems.length} Fiesta` : ''}.`
                : hasFiestaItems
                    ? `Ritning exporterad till offert med ${config.fiestaItems.length} Fiesta.`
                    : 'Ritning exporterad till offert.',
            metadata: {
                width: config.width,
                depthLeft: config.depthLeft,
                depthRight: config.depthRight,
                sectionCount: layout.allSections.length,
                parasolCount: (config.parasols || []).length,
                fiestaCount: (config.fiestaItems || []).length
            }
        }).then((result) => warnIfActivityLogFailed(result, 'Exporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));

        if (autoAdjustedEdges.length > 0) {
            const adjusted = autoAdjustedEdges
                .map(
                    ([edge, diag]) =>
                        `${EDGE_LABELS[edge] || edge}: ${diag.requestedDoorSize} -> ${diag.resolvedDoorSize} mm`
                )
                .join(', ');
            toast('Dörrstorlek justerades automatiskt: ' + adjusted, { icon: '⚠️' });
        }

        const successMsg = hasParasols
            ? `Exporterade skissen och ${config.parasols.length} st parasoller${hasFiestaItems ? ` samt ${config.fiestaItems.length} st Fiesta` : ''} till offerten.`
            : hasFiestaItems
                ? `Exporterade skissen och ${config.fiestaItems.length} st Fiesta till offerten.`
                : 'Exporterade skissen till offerten.';

        toast.success(successMsg);
    };

    const handleExportImage = async () => {
        const element = document.getElementById('sketchCanvasContainer');
        if (!element) {
            toast.error('Kan inte hitta skissen att exportera.');
            return;
        }

        // Temporarily hide drag handles
        const handles = element.querySelectorAll('.sketch-drag-handle');
        handles.forEach(h => h.style.display = 'none');

        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = '#0b1220';

        const toastId = toast.loading('Genererar bild...');
        const fileName = `Uteservering_Skiss_${config.width}x${config.depthLeft}.png`;

        try {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#0b1220'
            });

            canvas.toBlob(async (blob) => {
                handles.forEach(h => h.style.display = '');
                element.style.backgroundColor = originalBg;

                const pickerResult = await saveBlobWithPicker(blob, fileName);

                if (pickerResult === 'saved') {
                    void safeLogActivity({
                        user,
                        eventType: 'sketch_export_image',
                        system: 'sketch',
                        targetType: 'sketch',
                        targetId: 'sketch_canvas',
                        details: `Ritningsbild sparad: ${fileName}`,
                        metadata: {
                            format: 'png',
                            fileName,
                            width: config.width,
                            depthLeft: config.depthLeft,
                            depthRight: config.depthRight,
                            sectionCount: layout.allSections.length,
                            parasolCount: (config.parasols || []).length,
                            fiestaCount: (config.fiestaItems || []).length
                        }
                    }).then((result) => warnIfActivityLogFailed(result, 'Bildexporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));
                    toast.success(`Skiss sparad: ${fileName}`, { id: toastId });
                } else if (pickerResult === 'canceled') {
                    toast.dismiss(toastId);
                    toast('Bildexport avbröts.', { icon: '!' });
                } else {
                    if (pickerResult === 'failed') {
                        toast('Kunde inte öppna spara-dialog. Använder nedladdning istället.', { icon: '!' });
                    }
                    downloadBlob(blob, fileName);
                    void safeLogActivity({
                        user,
                        eventType: 'sketch_export_image',
                        system: 'sketch',
                        targetType: 'sketch',
                        targetId: 'sketch_canvas',
                        details: `Ritningsbild nedladdad: ${fileName}`,
                        metadata: {
                            format: 'png',
                            fileName,
                            width: config.width,
                            depthLeft: config.depthLeft,
                            depthRight: config.depthRight,
                            sectionCount: layout.allSections.length,
                            parasolCount: (config.parasols || []).length,
                            fiestaCount: (config.fiestaItems || []).length
                        }
                    }).then((result) => warnIfActivityLogFailed(result, 'Bildexporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));
                    toast.success(`Skiss nedladdad: ${fileName}`, { id: toastId });
                }
            }, 'image/png');
        } catch (err) {
            handles.forEach(h => h.style.display = '');
            element.style.backgroundColor = originalBg;
            toast.error('Kunde inte skapa bild: ' + (err?.message || 'okänt fel'), { id: toastId });
        }
    };

    const handleBackClick = useCallback(() => {
        dispatch({
            type: 'UPDATE_STATE',
            payload: {
                sketchDraft: {
                    config: serializeSketchConfig(config),
                    workspace
                }
            }
        });
        onBack?.();
    }, [config, dispatch, onBack, workspace]);

    return (
        <div className="animate-slide-in space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-semibold text-text-primary m-0">Rita Uteservering</h2>
                    <p className="text-text-secondary mt-1 m-0">
                        Skissa en rektangel och beräkna optimala ClickitUP-sektioner automatiskt.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <button
                            onClick={resetSketch}
                            className="px-3 py-2 rounded-lg text-sm border border-panel-border bg-input-bg text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Återställ ritning
                        </button>
                        <div className="flex rounded-lg border border-panel-border overflow-hidden bg-input-bg">
                            {['desktop', 'touch'].map((density) => (
                                <button
                                    key={density}
                                    onClick={() => setWorkspace((prev) => ({ ...prev, uiDensity: density }))}
                                    className={`px-3 py-2 text-sm transition-colors ${workspace.uiDensity === density
                                        ? 'bg-white/10 text-text-primary'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                        }`}
                                >
                                    {density === 'desktop' ? 'Desktop' : 'Touch'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleBackClick}
                        className="px-5 py-2 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer hover:bg-white/5 shadow-sm"
                    >
                        ← Tillbaka
                    </button>
                </div>
            </div>

            {criticalWarnings.length > 0 && (
                <div className="p-4 rounded-lg border border-danger/40 bg-danger/10 text-danger text-sm">
                    <p className="font-semibold m-0 mb-1">Kritiska varningar ({criticalWarnings.length})</p>
                    <ul className="m-0 pl-5 space-y-1">
                        {criticalWarnings.map((warning) => (
                            <li key={warning.id}>{warning.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            {warningWarnings.length > 0 && (
                <div className="p-4 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-200 text-sm">
                    <p className="font-semibold m-0 mb-1">Rekommendationer ({warningWarnings.length})</p>
                    <ul className="m-0 pl-5 space-y-1">
                        {warningWarnings.map((warning) => (
                            <li key={warning.id}>{warning.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <div className="space-y-6">
                    <SketchConfig
                        config={config}
                        onChange={updateConfig}
                        selectedEdge={workspace.selection.edgeKey}
                        selectedSegmentIndex={workspace.selection.segmentIndex}
                        onSelectEdge={handleSelectEdge}
                        onSetManualPin={setManualPin}
                        onClearManualPins={clearManualPins}
                        onConvertSegmentToDoor={setDoorSegmentSize}
                        onSetDoorSegmentSize={setDoorSegmentSize}
                        onResetDoorSegment={resetDoorSegment}
                        edgeSummaries={layout.edgeSummaries}
                        onDeleteParasol={handleDeleteParasol}
                        onRotateParasol={handleRotateParasol}
                        onDeleteFiesta={handleDeleteFiesta}
                    />

                    <div className="bg-panel-bg border border-panel-border rounded-xl p-5">
                        <h3 className="text-lg font-semibold text-text-primary m-0 mb-3">Förslag</h3>
                        {layout.suggestions.length === 0 ? (
                            <p className="text-sm text-text-secondary m-0">Inga aktiva förslag just nu.</p>
                        ) : (
                            <div className="space-y-2">
                                {layout.suggestions.slice(0, 8).map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        onClick={() => applySuggestion(suggestion.id)}
                                        className="w-full text-left p-3 rounded-lg border border-panel-border bg-input-bg hover:bg-white/5 transition-colors"
                                    >
                                        <span className="block text-sm text-text-primary">{suggestion.text}</span>
                                        <span className="block text-xs text-text-secondary mt-1">
                                            {EDGE_LABELS[suggestion.edge] || suggestion.edge} · prioritet {suggestion.priority}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <SketchBom
                        counts={layout.counts}
                        totalGlassLength={layout.totalGlassLength}
                        slimlineCount={layout.slimlineCount}
                        stodbenCount={layout.stodbenCount}
                        hasInvalidEdges={layout.hasInvalidEdges}
                        invalidEdges={invalidEdges}
                        autoAdjustedEdges={autoAdjustedEdges}
                        parasols={config.parasols}
                        fiestaItems={config.fiestaItems}
                        parasolWarnings={parasolWarnings}
                        canExportToQuote={canExportSketchToQuote}
                        onExport={handleExportClick}
                        onExportImage={handleExportImage}
                    />
                </div>

                <div className="xl:sticky xl:top-4 xl:self-start space-y-4">
                    <SketchCanvas
                        activeMode={config.activeMode}
                        parasols={config.parasols}
                        selectedParasolId={config.selectedParasolId}
                        fiestaItems={config.fiestaItems}
                        selectedFiestaId={config.selectedFiestaId}
                        onPlaceParasol={handlePlaceParasol}
                        onSelectParasol={handleSelectParasol}
                        onMoveParasol={handleMoveParasol}
                        onPlaceFiesta={handlePlaceFiesta}
                        onSelectFiesta={handleSelectFiesta}
                        onMoveFiesta={handleMoveFiesta}
                        onChangeMode={handleChangeMode}
                        width={previewConfig.width}
                        depth={previewConfig.depth}
                        depthLeft={previewConfig.depthLeft}
                        depthRight={previewConfig.depthRight}
                        equalDepth={previewConfig.equalDepth}
                        includeBack={previewConfig.includeBack}
                        leftEdge={previewLayout.leftEdge}
                        rightEdge={previewLayout.rightEdge}
                        frontEdge={previewLayout.frontEdge}
                        backEdge={previewLayout.backEdge}
                        edgeDiagnostics={previewLayout.edgeDiagnostics}
                        edgeSummaries={previewLayout.edgeSummaries}
                        layoutWarnings={previewLayout.layoutWarnings}
                        suggestions={previewLayout.suggestions}
                        camera={workspace.camera}
                        selection={workspace.selection}
                        uiDensity={workspace.uiDensity}
                        onSelectEdge={handleSelectEdge}
                        onSelectSection={(edgeKey, segmentIndex) => {
                            setWorkspace((prev) => ({
                                ...prev,
                                selection: { edgeKey, segmentIndex }
                            }));
                        }}
                        onApplySuggestion={applySuggestion}
                        onCameraChange={handleCameraChange}
                        onResizePreview={handleResizePreview}
                        onResizeCommit={handleResizeCommit}
                    />

                    <div className="flex flex-wrap justify-center gap-4 text-sm text-text-secondary">
                        <span>
                            Bredd: <b className="text-text-primary">{layout.edgeSummaries?.front?.effectiveLength ?? config.width} mm</b>
                        </span>
                        {config.equalDepth ? (
                            <span>Djup: <b className="text-text-primary">{layout.edgeSummaries?.left?.effectiveLength ?? config.depth} mm</b></span>
                        ) : (
                            <>
                                <span>Vänster: <b className="text-text-primary">{layout.edgeSummaries?.left?.effectiveLength ?? config.depthLeft} mm</b></span>
                                <span>Höger: <b className="text-text-primary">{layout.edgeSummaries?.right?.effectiveLength ?? config.depthRight} mm</b></span>
                            </>
                        )}
                        <span>
                            Sektioner: <b className="text-text-primary">{layout.allSections.length} st</b>
                        </span>
                    </div>
                </div>
            </div>

            {showStockModal && (
                <StockComparisonModal
                    allSections={layout.allSections}
                    slimlineCount={layout.slimlineCount}
                    stodbenCount={layout.stodbenCount}
                    clickitupStock={state.inventoryData?.clickitup || {}}
                    onConfirm={commitExport}
                    onCancel={() => setShowStockModal(false)}
                />
            )}
        </div>
    );
}




