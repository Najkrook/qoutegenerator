import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { buildSketchExportState } from '../features/sketchExportState';
import { SketchCanvas } from '../components/features/SketchCanvas';
import { SketchInspectorPanel, SketchSetupPanel } from '../components/features/SketchConfig';
import { SketchReviewPanel } from '../components/features/SketchBom';
import { StockComparisonModal } from '../components/features/StockComparisonModal';
import toast from 'react-hot-toast';
import { safeLogActivity } from '../services/activityLogService';
import type {
    ComputedLayoutResult,
    DoorSegment,
    DoorSegmentsByEdge,
    EdgeDiagnostic,
    GridCustomAddonRow,
    GridLineSelection,
    ManualSectionsByEdge,
    PlacedFiesta,
    PlacedParasol,
    SectionCountByEdge,
    SketchCamera,
    SketchConfigState,
    SketchDensity,
    SketchDraftStatePatch,
    SketchEdgeKey,
    SketchReviewState,
    SketchSectionEntry,
    SketchToolProps,
    SketchWorkspace
} from '../types/contracts';

type SketchConfigInput = Partial<SketchConfigState> & {
    doorEdges?: SketchEdgeKey[] | Set<SketchEdgeKey>;
    doorSizeByEdge?: Partial<Record<SketchEdgeKey, number>>;
};

type DragPreview = Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>>;

const EDGE_LABELS: Record<SketchEdgeKey, string> = {
    front: 'Fram',
    left: 'Vänster',
    right: 'Höger',
    back: 'Bak'
};

const EDGE_KEYS: SketchEdgeKey[] = ['front', 'left', 'right', 'back'];
const DEFAULT_CAMERA: SketchCamera = { zoom: 1, panX: 0, panY: 0 };

function roundToStep(value: number): number {
    return Math.round(value / STEP_MM) * STEP_MM;
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function nearestFromList(value: number, list: number[]): number {
    return list.reduce((best, current) => {
        const bestDiff = Math.abs(best - value);
        const currentDiff = Math.abs(current - value);
        if (currentDiff < bestDiff) return current;
        if (currentDiff === bestDiff && current > best) return current;
        return best;
    }, list[0]);
}

function normalizeDimension(rawValue: unknown, fallback: number): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, MIN_DIMENSION_MM, 50000);
}

function normalizeDepth(rawValue: unknown, fallback: number): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, 0, 50000);
}

function normalizeTarget(rawValue: unknown, fallback: number): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return nearestFromList(clamp(rounded, 700, 2000), SECTION_SIZES);
}

function normalizeDoorSize(rawValue: unknown): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : 1000;
    return nearestFromList(base, DOOR_SIZES);
}

function normalizeDoorSegment(rawSegment: Partial<DoorSegment> | null | undefined, fallbackIndex = 0): DoorSegment {
    const parsedIndex = Number(rawSegment?.index);
    const normalizedIndex = Number.isInteger(parsedIndex) && parsedIndex >= 0 ? parsedIndex : fallbackIndex;
    return {
        index: normalizedIndex,
        size: normalizeDoorSize(rawSegment?.size)
    };
}

function normalizeDoorSegments(rawSegments: unknown = []): DoorSegment[] {
    if (!Array.isArray(rawSegments)) return [];

    const byIndex = new Map();
    rawSegments.forEach((segment, position) => {
        const normalized = normalizeDoorSegment(segment, position);
        byIndex.set(normalized.index, normalized);
    });

    return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

function normalizeDoorSegmentsByEdge(
    config: SketchConfigInput,
    includeBack: boolean,
    hasLeftDepth: boolean,
    hasRightDepth: boolean
): DoorSegmentsByEdge {
    const rawDoorSegmentsByEdge = config.doorSegmentsByEdge;
    const hasNewModel = rawDoorSegmentsByEdge && typeof rawDoorSegmentsByEdge === 'object' && !Array.isArray(rawDoorSegmentsByEdge);
    const normalized: DoorSegmentsByEdge = {};

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

function normalizeManualSectionsByEdge(rawManualSectionsByEdge: unknown, doorSegmentsByEdge: DoorSegmentsByEdge): ManualSectionsByEdge {
    const normalized: ManualSectionsByEdge = {};

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

function normalizeSectionCountByEdge(rawCounts: unknown): SectionCountByEdge {
    const normalized: SectionCountByEdge = {};
    if (!rawCounts || typeof rawCounts !== 'object') return normalized;

    EDGE_KEYS.forEach((edge) => {
        const parsed = Number.parseInt(rawCounts[edge], 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            normalized[edge] = parsed;
        }
    });

    return normalized;
}

function normalizeParasol(parasol: Partial<PlacedParasol> | null | undefined): PlacedParasol | null {
    if (!parasol) return null;

    return {
        ...parasol,
        id: String(parasol.id),
        rotationDeg: parasol.rotationDeg === 90 ? 90 : 0
    } as PlacedParasol;
}

function normalizeFiesta(fiesta: Partial<PlacedFiesta> | null | undefined): PlacedFiesta | null {
    return normalizeFiestaItem(fiesta);
}

function sanitizeConfig(config: SketchConfigInput): SketchConfigState {
    const next: SketchConfigInput = { ...config };
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
    next.sectionCountByEdge = normalizeSectionCountByEdge(config.sectionCountByEdge);
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
    return next as SketchConfigState;
}

function parseDoorSize(section: SketchSectionEntry): number | null {
    const match = new RegExp(`${DOOR_LABEL}\\s+(\\d+)`, 'i').exec(String(section));
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function getInitialDensity(): SketchDensity {
    if (typeof window === 'undefined') {
        return 'desktop';
    }
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return coarse ? 'touch' : 'desktop';
}

function serializeSketchConfig(config: SketchConfigState): SketchConfigState {
    const { doorEdges, doorSizeByEdge, ...rest } = config || {};
    return {
        ...rest
    } as SketchConfigState;
}

function createDefaultSketchConfig(): SketchConfigState {
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
        sectionCountByEdge: {},
        activeMode: 'clickitup',
        parasols: [],
        selectedParasolId: null,
        selectedParasolPresetId: DEFAULT_PARASOL_PRESET_ID,
        fiestaItems: [],
        selectedFiestaId: null
    };
}

function cloneSketchConfig(config?: SketchConfigInput | null): SketchConfigState {
    return sanitizeConfig(JSON.parse(JSON.stringify(config || createDefaultSketchConfig())));
}

function cloneWorkspace(saved: Partial<SketchWorkspace> = {}): SketchWorkspace {
    return {
        camera: { ...DEFAULT_CAMERA, ...(saved.camera || {}) },
        selection: {
            edgeKey: saved.selection?.edgeKey || 'front',
            segmentIndex: saved.selection?.segmentIndex ?? null
        },
        uiDensity: saved.uiDensity || getInitialDensity()
    };
}

function warnIfActivityLogFailed(result: { ok?: boolean } | null | undefined, message: string): void {
    if (result?.ok === false) {
        toast(message, { icon: '!' });
    }
}

function buildMaterialRows(layout: ComputedLayoutResult, parasols: PlacedParasol[] = [], fiestaItems: PlacedFiesta[] = []): SketchReviewState['materialRows'] {
    const keys = Object.keys(layout.counts || {});
    const doorKeys = keys
        .filter((key) => String(key).includes('Dörr'))
        .sort((a, b) => Number.parseInt(b, 10) - Number.parseInt(a, 10));
    const sectionKeys = keys
        .filter((key) => !String(key).includes('Dörr'))
        .sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a));

    const rows: SketchReviewState['materialRows'] = [...doorKeys, ...sectionKeys].map((key) => ({
        id: key,
        label: String(key).includes('Dörr') ? key : `ClickitUp Sektion ${key} mm`,
        qty: layout.counts[key],
        tone: 'default' as const
    }));

    if (layout.slimlineCount > 0) {
        rows.push({
            id: 'slimline',
            label: 'Slimline (stöd för dörr)',
            qty: layout.slimlineCount,
            tone: 'secondary' as const
        });
    }

    if (layout.stodbenCount > 0) {
        rows.push({
            id: 'stodben',
            label: 'Stödben 45° (för fri ände)',
            qty: layout.stodbenCount,
            tone: 'secondary' as const
        });
    }

    const parasolCounts = parasols.reduce<Record<string, number>>((acc, parasol) => {
        acc[parasol.label] = (acc[parasol.label] || 0) + 1;
        return acc;
    }, {});

    Object.keys(parasolCounts).sort().forEach((label) => {
        rows.push({
            id: `parasol-${label}`,
            label: `Parasoll ${label}`,
            qty: parasolCounts[label],
            tone: 'default' as const
        });
    });

    if (fiestaItems.length > 0) {
        rows.push({
            id: 'fiesta',
            label: 'Fiesta 70 cm',
            qty: fiestaItems.length,
            tone: 'default' as const
        });
    }

    return rows;
}

export function SketchTool({ onBack, onExportToQuoteComplete }: SketchToolProps) {
    const { state, dispatch } = useQuote();
    const { user, canExportSketchToQuote } = useAuth();

    const initialConfigRef = useRef<SketchConfigState>(cloneSketchConfig(state.sketchDraft?.config || createDefaultSketchConfig()));
    const initialWorkspaceRef = useRef<SketchWorkspace>(cloneWorkspace(state.sketchDraft?.workspace || {}));

    const [config, setConfig] = useState<SketchConfigState>(() => cloneSketchConfig(initialConfigRef.current));
    const [workspace, setWorkspace] = useState<SketchWorkspace>(() => cloneWorkspace(initialWorkspaceRef.current));

    const [showStockModal, setShowStockModal] = useState(false);
    const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
    const [activeSidebarTab, setActiveSidebarTab] = useState<'inspector' | 'review'>('inspector');

    const updateConfig = useCallback((partial: Partial<SketchConfigState>) => {
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

    const layout = useMemo<ComputedLayoutResult>(() => computeLayout(config), [config]);
    const previewConfig = useMemo<SketchConfigState>(() => {
        if (!dragPreview) return config;
        return sanitizeConfig({
            ...config,
            ...dragPreview,
            doorSegmentsByEdge: config.doorSegmentsByEdge,
            manualSectionsByEdge: config.manualSectionsByEdge
        });
    }, [config, dragPreview]);
    const previewLayout = useMemo<ComputedLayoutResult>(
        () => (dragPreview ? computeLayout(previewConfig) : layout),
        [dragPreview, previewConfig, layout]
    );

    const invalidEdges = useMemo<Array<[SketchEdgeKey, EdgeDiagnostic]>>(
        () => Object.entries(layout.edgeDiagnostics || {}).filter(([, diag]) => !diag.valid) as Array<[SketchEdgeKey, EdgeDiagnostic]>,
        [layout.edgeDiagnostics]
    );

    const autoAdjustedEdges = useMemo<Array<[SketchEdgeKey, EdgeDiagnostic]>>(
        () => Object.entries(layout.edgeDiagnostics || {}).filter(([, diag]) => diag.valid && diag.autoAdjusted) as Array<[SketchEdgeKey, EdgeDiagnostic]>,
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
            selection: { edgeKey, segmentIndex: null }
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

    const setSectionCount = useCallback((edgeKey, count) => {
        updateConfig({
            sectionCountByEdge: {
                ...config.sectionCountByEdge,
                [edgeKey]: count
            }
        });
    }, [config.sectionCountByEdge, updateConfig]);

    const clearSectionCount = useCallback((edgeKey) => {
        const next = { ...config.sectionCountByEdge };
        delete next[edgeKey];
        updateConfig({ sectionCountByEdge: next });
    }, [config.sectionCountByEdge, updateConfig]);

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
            } else if (suggestion.type === 'setSectionCount') {
                setSectionCount(suggestion.edge, suggestion.value);
            } else if (suggestion.type === 'clearSectionCount') {
                clearSectionCount(suggestion.edge);
            }

            setWorkspace((prev) => ({
                ...prev,
                selection: { ...prev.selection, edgeKey: suggestion.edge }
            }));

            toast.success('Förslag applicerat.');
        },
        [clearSectionCount, config.equalDepth, layout.suggestions, resetDoorSegment, setDoorSegmentSize, setSectionCount, updateConfig]
    );

    const parasolWarnings = useMemo(
        () => computeParasolOverlapWarnings(config.parasols || []),
        [config.parasols]
    );

    const parasolAreaPolygon = useMemo(
        () => getAreaPolygon(config),
        [config.width, config.depth, config.depthLeft, config.depthRight, config.equalDepth]
    );

    const sketchReviewState = useMemo<SketchReviewState>(() => {
        const materialRows = buildMaterialRows(layout, config.parasols || [], config.fiestaItems || []);
        const health = criticalWarnings.length > 0 || invalidEdges.length > 0
            ? 'blocked'
            : (warningWarnings.length > 0 || autoAdjustedEdges.length > 0 || parasolWarnings.length > 0 || layout.suggestions.length > 0)
                ? 'attention'
                : 'ready';

        const healthLabel = health === 'blocked'
            ? 'Kräver åtgärd'
            : health === 'attention'
                ? 'Behöver översyn'
                : 'Redo';

        const healthText = health === 'blocked'
            ? 'Layouten har blockerande problem som bör granskas innan export.'
            : health === 'attention'
                ? 'Layouten är exportbar men har rekommendationer eller autojusteringar att granska.'
                : 'Layouten ser klar ut och kan exporteras direkt.';

        return {
            health,
            healthLabel,
            healthText,
            criticalWarnings,
            recommendationWarnings: warningWarnings,
            suggestions: layout.suggestions || [],
            invalidEdges,
            autoAdjustedEdges,
            parasolWarnings,
            materialRows,
            totalGlassLength: layout.totalGlassLength,
            sectionCount: layout.allSections.length,
            parasolCount: (config.parasols || []).length,
            fiestaCount: (config.fiestaItems || []).length,
            exportReady: canExport,
            hasInvalidEdges: layout.hasInvalidEdges
        };
    }, [
        autoAdjustedEdges,
        canExport,
        config.fiestaItems,
        config.parasols,
        criticalWarnings,
        invalidEdges,
        layout,
        parasolWarnings,
        warningWarnings
    ]);

    const handleChangeMode = useCallback((mode) => {
        updateConfig({
            activeMode: mode,
            selectedParasolId: mode === 'parasol' ? config.selectedParasolId : null,
            selectedFiestaId: mode === 'fiesta' ? config.selectedFiestaId : null
        });
        setActiveSidebarTab('inspector');
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
            rotationDeg: 0 as const,
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

    useEffect(() => {
        const hasFocusedSelection = Boolean(
            config.selectedParasolId ||
            config.selectedFiestaId ||
            workspace.selection.segmentIndex !== null ||
            workspace.selection.edgeKey
        );
        if (hasFocusedSelection) {
            setActiveSidebarTab('inspector');
        }
    }, [config.selectedFiestaId, config.selectedParasolId, workspace.selection.edgeKey, workspace.selection.segmentIndex]);

    const handleExportClick = () => {
        if (!canExportSketchToQuote) {
            toast.error('Du har inte behörighet att exportera till offert.');
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
        const preservedCustomAddons = Object.entries(state.gridSelections?.ClickitUp?.customAddonsByCategory || {}).reduce<Record<string, GridCustomAddonRow[]>>((acc, [categoryId, rows]) => {
            acc[categoryId] = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
            return acc;
        }, {});
        const cuGrid: GridLineSelection = { items: {}, addons: {}, customAddonsByCategory: preservedCustomAddons };

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

        gridSelections.ClickitUp = cuGrid;

        dispatch({ type: 'SET_SELECTED_LINES', payload: nextSketchExportState.selectedLines });
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: gridSelections });
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: nextSketchExportState.builderItems });
        const sketchExportStatePatch: SketchDraftStatePatch = {
            sketchDraft: {
                config: serializeSketchConfig(config),
                workspace
            },
            sketchMeta: nextSketchExportState.sketchMeta
        };
        dispatch({
            type: 'UPDATE_STATE',
            payload: sketchExportStatePatch
        });
        onExportToQuoteComplete?.();
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
        const handles = Array.from(element.querySelectorAll<HTMLElement>('.sketch-drag-handle'));
        handles.forEach((handle) => {
            handle.style.display = 'none';
        });

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
                handles.forEach((handle) => {
                    handle.style.display = '';
                });
                element.style.backgroundColor = originalBg;

                if (!blob) {
                    toast.error('Kunde inte skapa bildfil.', { id: toastId });
                    return;
                }

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
            handles.forEach((handle) => {
                handle.style.display = '';
            });
            element.style.backgroundColor = originalBg;
            const errorMessage = err instanceof Error ? err.message : 'okänt fel';
            toast.error(`Kunde inte skapa bild: ${errorMessage}`, { id: toastId });
        }
    };

    const handleBackClick = useCallback(() => {
        const sketchDraftStatePatch: SketchDraftStatePatch = {
            sketchDraft: {
                config: serializeSketchConfig(config),
                workspace
            }
        };
        dispatch({
            type: 'UPDATE_STATE',
            payload: sketchDraftStatePatch
        });
        onBack?.();
    }, [config, dispatch, onBack, workspace]);

    return (
        <div className="animate-slide-in space-y-5">
            <div className="sticky top-4 z-20 rounded-2xl border border-panel-border bg-panel-bg/95 p-3 shadow-lg backdrop-blur md:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-semibold text-text-primary m-0">Rita Uteservering</h2>
                        <p className="text-text-secondary m-0">
                            Skissa en rektangel och beräkna optimala ClickitUp-sektioner automatiskt.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${sketchReviewState.health === 'blocked'
                                ? 'border-danger/50 text-danger bg-danger/10'
                                : sketchReviewState.health === 'attention'
                                    ? 'border-amber-400/40 text-amber-200 bg-amber-500/10'
                                    : 'border-success/40 text-success bg-success/10'
                                }`}
                        >
                            {sketchReviewState.healthLabel}
                        </span>
                        <button
                            onClick={handleBackClick}
                            className="h-10 px-4 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            Till offert
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={handleExportImage}
                                disabled={!canExport}
                                className="h-10 px-4 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Ladda ner bild
                            </button>
                            <button
                                onClick={resetSketch}
                                className="h-10 px-4 border border-red-900/50 bg-red-950/20 text-red-300 rounded-lg cursor-pointer hover:text-white hover:border-red-500/60 hover:bg-red-800/40 transition-colors"
                            >
                                Återställ
                            </button>
                        </div>
                        <button
                            onClick={handleExportClick}
                            disabled={!canExport || !canExportSketchToQuote}
                            className="h-10 px-4 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            Exportera till offert
                        </button>
                    </div>
                </div>
            </div>

            {criticalWarnings.length > 0 && (
                <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-danger text-sm">
                    <p className="font-semibold m-0 mb-1">Blockerande problem ({criticalWarnings.length})</p>
                    <ul className="m-0 pl-5 space-y-1">
                        {criticalWarnings.map((warning) => (
                            <li key={warning.id}>{warning.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[308px_minmax(0,1fr)_340px] xl:gap-4 2xl:gap-5">
                <div className="space-y-5 xl:self-start">
                    <SketchSetupPanel
                        config={config}
                        onChange={updateConfig}
                        edgeSummaries={layout.edgeSummaries}
                        onSetSectionCount={setSectionCount}
                        onClearSectionCount={clearSectionCount}
                    />
                </div>

                <div className="min-w-0 space-y-2">
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
                            setActiveSidebarTab('inspector');
                            setWorkspace((prev) => ({
                                ...prev,
                                selection: { edgeKey, segmentIndex }
                            }));
                        }}
                        onCameraChange={handleCameraChange}
                        onResizePreview={handleResizePreview}
                        onResizeCommit={handleResizeCommit}
                    />

                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border border-panel-border bg-panel-bg/70 px-4 py-2 text-xs text-text-secondary">
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

                <div className="hidden xl:flex xl:flex-col xl:gap-4 xl:self-start">
                    <SketchInspectorPanel
                        config={config}
                        onChange={updateConfig}
                        selectedEdge={workspace.selection.edgeKey}
                        selectedSegmentIndex={workspace.selection.segmentIndex}
                        edgeSummaries={layout.edgeSummaries}
                        suggestions={layout.suggestions}
                        onSetManualPin={setManualPin}
                        onClearManualPins={clearManualPins}
                        onConvertSegmentToDoor={setDoorSegmentSize}
                        onSetDoorSegmentSize={setDoorSegmentSize}
                        onResetDoorSegment={resetDoorSegment}
                        onApplySuggestion={applySuggestion}
                        onDeleteParasol={handleDeleteParasol}
                        onRotateParasol={handleRotateParasol}
                        onDeleteFiesta={handleDeleteFiesta}
                    />

                    <SketchReviewPanel
                        reviewState={sketchReviewState}
                        canExportToQuote={canExportSketchToQuote}
                        onApplySuggestion={applySuggestion}
                        onExport={handleExportClick}
                        onExportImage={handleExportImage}
                    />
                </div>
            </div>

            <div className="space-y-3 xl:hidden">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSidebarTab('inspector')}
                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${activeSidebarTab === 'inspector'
                            ? 'border-blue-200/60 bg-primary text-white'
                            : 'border-panel-border bg-panel-bg text-text-primary hover:bg-white/5'
                            }`}
                    >
                        Inspektör
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSidebarTab('review')}
                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${activeSidebarTab === 'review'
                            ? 'border-blue-200/60 bg-primary text-white'
                            : 'border-panel-border bg-panel-bg text-text-primary hover:bg-white/5'
                            }`}
                    >
                        Granska & exportera
                    </button>
                </div>

                {activeSidebarTab === 'inspector' ? (
                    <SketchInspectorPanel
                        config={config}
                        onChange={updateConfig}
                        selectedEdge={workspace.selection.edgeKey}
                        selectedSegmentIndex={workspace.selection.segmentIndex}
                        edgeSummaries={layout.edgeSummaries}
                        suggestions={layout.suggestions}
                        onSetManualPin={setManualPin}
                        onClearManualPins={clearManualPins}
                        onConvertSegmentToDoor={setDoorSegmentSize}
                        onSetDoorSegmentSize={setDoorSegmentSize}
                        onResetDoorSegment={resetDoorSegment}
                        onApplySuggestion={applySuggestion}
                        onDeleteParasol={handleDeleteParasol}
                        onRotateParasol={handleRotateParasol}
                        onDeleteFiesta={handleDeleteFiesta}
                    />
                ) : (
                    <SketchReviewPanel
                        reviewState={sketchReviewState}
                        canExportToQuote={canExportSketchToQuote}
                        onApplySuggestion={applySuggestion}
                        onExport={handleExportClick}
                        onExportImage={handleExportImage}
                    />
                )}
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




