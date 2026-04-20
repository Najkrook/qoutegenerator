import type {
    ComputedLayoutResult,
    DoorSegment,
    DoorSegmentsByEdge,
    EdgeDiagnostic,
    EdgeGeometry,
    EdgeSummary,
    LayoutSuggestion,
    LayoutWarning,
    LayoutWarningLevel,
    ManualSectionPin,
    ManualSectionsByEdge,
    RawDoorSegment,
    RawDoorSegmentsByEdge,
    RawManualSectionPin,
    RawManualSectionsByEdge,
    RawSectionCountByEdge,
    SectionCountByEdge,
    SketchConfigState,
    SketchEdgeKey,
    SketchPriorityMode,
    SketchRenderedSegment,
    SketchSectionEntry,
    UnknownRecord
} from '../types/contracts';

/**
 * Section calculator for ClickitUp outdoor seating layouts.
 * Pure logic - no UI dependencies.
 */

export const STEP_MM = 100;
export const MIN_DIMENSION_MM = 1000;
export const SECTION_SIZES = [2000, 1900, 1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100, 1000, 700];
export const DOOR_SIZES = [1100, 1000, 700];
export const MIN_SECTION_SIZE = 700;
export const STANDARD_SIZES = SECTION_SIZES;
export const DOOR_LABEL = 'Dörr';

export const SIDE_CORNER_OVERLAP_MM = 100;
export const CORNER_POST_BUILD_MM = 80;
export const SIDE_NET_REDUCTION_MM = SIDE_CORNER_OVERLAP_MM - CORNER_POST_BUILD_MM;

type SketchConfigInput = Partial<SketchConfigState> & {
    depth?: number;
    doorEdges?: SketchEdgeKey[] | Set<SketchEdgeKey>;
    doorSizeByEdge?: Partial<Record<SketchEdgeKey, number>>;
};

interface SolveEdgeOptions {
    prioMode?: unknown;
    targetLength?: unknown;
    doorSegments?: unknown;
    sectionPins?: unknown;
    sectionCount?: number | null;
    doorSize?: unknown;
}

interface OccupiedEntry {
    index: number;
    kind: 'door' | 'section';
    value: SketchSectionEntry;
    size: number;
}

interface SolveEdgeResult {
    sections: SketchSectionEntry[];
    valid: boolean;
    requestedDoorSize: number | null;
    resolvedDoorSize: number | null;
    autoAdjusted: boolean;
    errorCode: EdgeDiagnostic['errorCode'];
}

const EDGE_KEYS: SketchEdgeKey[] = ['front', 'left', 'right', 'back'];

const EDGE_TO_DIMENSION: Record<SketchEdgeKey, 'width' | 'depthLeft' | 'depthRight'> = {
    front: 'width',
    back: 'width',
    left: 'depthLeft',
    right: 'depthRight'
};

const EDGE_LENGTH_LABEL: Record<SketchEdgeKey, string> = {
    front: 'framkant',
    back: 'bakkant',
    left: 'vänsterkant',
    right: 'högerkant'
};

function getEdgeRequestedMin(edgeKey: SketchEdgeKey): number {
    return edgeKey === 'left' || edgeKey === 'right' ? 0 : MIN_DIMENSION_MM;
}

export function computeEdgeRequestedLength(edgeKey: SketchEdgeKey, config: SketchConfigInput): number {
    switch (edgeKey) {
        case 'front':
            return normalizeNumber(config.width, { fallback: 4000, min: MIN_DIMENSION_MM, max: 50000 });
        case 'back':
            return normalizeNumber(config.width, { fallback: 4000, min: MIN_DIMENSION_MM, max: 50000 });
        case 'left':
            return normalizeNumber(config.depthLeft ?? config.depth, { fallback: 3000, min: 0, max: 50000 });
        case 'right':
            return normalizeNumber(config.depthRight ?? config.depth, { fallback: 3000, min: 0, max: 50000 });
        default:
            return 0;
    }
}

export function computeEdgeEffectiveLength(edgeKey: SketchEdgeKey, requestedLength: number): number {
    if (edgeKey === 'left' || edgeKey === 'right') {
        return Math.max(0, requestedLength - SIDE_NET_REDUCTION_MM);
    }
    return requestedLength;
}

export function computeEdgeSolverLength(edgeKey: SketchEdgeKey, effectiveLength: number): number {
    if (edgeKey === 'left' || edgeKey === 'right') {
        return Math.floor(effectiveLength / STEP_MM) * STEP_MM;
    }
    return roundToStep(effectiveLength, STEP_MM);
}

export function computeEdgeGeometry(
    edgeKey: SketchEdgeKey,
    requestedLength: number,
    effectiveLength: number,
    solverLength: number
): EdgeGeometry {
    if (edgeKey === 'left' || edgeKey === 'right') {
        return {
            setbackMm: Math.max(0, requestedLength - effectiveLength),
            leadingPostMm: Math.max(0, effectiveLength - solverLength)
        };
    }
    return { setbackMm: 0, leadingPostMm: 0 };
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function roundToStep(value: number, step = STEP_MM): number {
    return Math.round(value / step) * step;
}

function normalizeNumber(rawValue: unknown, options: { fallback: number; min: number; max: number }): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : options.fallback;
    const rounded = roundToStep(base, STEP_MM);
    return clamp(rounded, options.min, options.max);
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

function normalizeMode(rawMode: unknown): SketchPriorityMode {
    if (rawMode === 'convenient' || rawMode === 'target' || rawMode === 'symmetrical') {
        return rawMode;
    }
    return 'symmetrical';
}

function buildMetrics(sections: number[], mode: SketchPriorityMode, target: number) {
    const count = sections.length;
    const spread = count > 1 ? sections[0] - sections[count - 1] : 0;
    const targetPenalty = sections.reduce((sum, size) => sum + Math.abs(size - target), 0);
    return { mode, count, spread, targetPenalty };
}

function isLexicographicallyBetter(a: number[], b: number[] | null): boolean {
    if (!b) return true;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        const av = a[i] ?? -Infinity;
        const bv = b[i] ?? -Infinity;
        if (av > bv) return true;
        if (av < bv) return false;
    }
    return false;
}

function isBetterCandidate(
    candidate: number[],
    incumbent: number[] | null,
    mode: SketchPriorityMode,
    target: number
): boolean {
    if (!incumbent) return true;

    const cand = buildMetrics(candidate, mode, target);
    const best = buildMetrics(incumbent, mode, target);

    if (mode === 'convenient') {
        if (cand.count !== best.count) return cand.count < best.count;
        return isLexicographicallyBetter(candidate, incumbent);
    }

    if (mode === 'symmetrical') {
        if (cand.targetPenalty !== best.targetPenalty) return cand.targetPenalty < best.targetPenalty;
        if (cand.spread !== best.spread) return cand.spread < best.spread;
        if (cand.count !== best.count) return cand.count < best.count;
        return isLexicographicallyBetter(candidate, incumbent);
    }

    if (cand.targetPenalty !== best.targetPenalty) return cand.targetPenalty < best.targetPenalty;
    if (cand.count !== best.count) return cand.count < best.count;
    if (cand.spread !== best.spread) return cand.spread < best.spread;
    return isLexicographicallyBetter(candidate, incumbent);
}

function solveExactFill(
    total: number,
    mode: SketchPriorityMode,
    targetLength: unknown,
    targetCount?: number | null
): number[] | null {
    if (!Number.isFinite(total) || total < 0) return null;
    if (total === 0) {
        if (Number.isFinite(targetCount) && targetCount > 0 && targetCount !== 0) return null;
        return [];
    }
    if (total < MIN_SECTION_SIZE) return null;
    if (total % STEP_MM !== 0) return null;

    const hasCountConstraint = Number.isFinite(targetCount) && Number(targetCount) > 0;
    const normalizedTarget = nearestFromList(
        normalizeNumber(targetLength, { fallback: 1500, min: 700, max: 2000 }),
        SECTION_SIZES
    );
    const memo = new Map<string, number[] | null>();

    function walk(remaining: number, startIdx: number, slotsLeft: number): number[] | null {
        if (remaining === 0) {
            return !hasCountConstraint || slotsLeft === 0 ? [] : null;
        }
        if (remaining < MIN_SECTION_SIZE) return null;
        if (hasCountConstraint && slotsLeft <= 0) return null;

        const memoKey = hasCountConstraint ? `${remaining}|${startIdx}|${slotsLeft}` : `${remaining}|${startIdx}`;
        if (memo.has(memoKey)) return memo.get(memoKey) ?? null;

        let best: number[] | null = null;
        for (let i = startIdx; i < SECTION_SIZES.length; i += 1) {
            const size = SECTION_SIZES[i];
            if (size > remaining) continue;

            const tail = walk(remaining - size, i, hasCountConstraint ? slotsLeft - 1 : slotsLeft);
            if (!tail) continue;

            const candidate = [size, ...tail];
            if (isBetterCandidate(candidate, best, mode, normalizedTarget)) {
                best = candidate;
            }
        }

        memo.set(memoKey, best);
        return best;
    }

    return walk(total, 0, hasCountConstraint ? Number(targetCount) : -1);
}

function normalizeDoorSize(rawDoorSize: unknown): number {
    const value = normalizeNumber(rawDoorSize, { fallback: 1000, min: 700, max: 1100 });
    return nearestFromList(value, DOOR_SIZES);
}

function normalizeSectionSize(rawSectionSize: unknown): number {
    const value = normalizeNumber(rawSectionSize, {
        fallback: 1600,
        min: MIN_SECTION_SIZE,
        max: 2000
    });
    return nearestFromList(value, SECTION_SIZES);
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toRawDoorSegment(value: unknown): RawDoorSegment | null {
    return isUnknownRecord(value) ? value : null;
}

function toRawManualSectionPin(value: unknown): RawManualSectionPin | null {
    return isUnknownRecord(value) ? value : null;
}

function toRawDoorSegmentsByEdge(value: unknown): RawDoorSegmentsByEdge {
    return isUnknownRecord(value) ? value : {};
}

function toRawManualSectionsByEdge(value: unknown): RawManualSectionsByEdge {
    return isUnknownRecord(value) ? value : {};
}

function toRawSectionCountByEdge(value: unknown): RawSectionCountByEdge {
    return isUnknownRecord(value) ? value : {};
}

function toRawDoorSizeByEdge(value: unknown): Partial<Record<SketchEdgeKey, unknown>> {
    return isUnknownRecord(value) ? value : {};
}

function normalizeDoorSegment(rawSegment: unknown, fallbackIndex = 0): DoorSegment | null {
    const candidate = toRawDoorSegment(rawSegment);
    if (!candidate) return null;

    const parsedIndex = Number.parseInt(String(candidate.index), 10);
    return {
        index: Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : fallbackIndex,
        size: normalizeDoorSize(candidate.size ?? candidate.doorSize ?? 1000)
    };
}

function normalizeDoorSegments(rawSegments: unknown = []): DoorSegment[] {
    const deduped = new Map<number, DoorSegment>();

    (Array.isArray(rawSegments) ? rawSegments : []).forEach((segment, fallbackIndex) => {
        const normalized = normalizeDoorSegment(segment, fallbackIndex);
        if (!normalized) return;
        deduped.set(normalized.index, normalized);
    });

    return [...deduped.values()].sort((a, b) => a.index - b.index);
}

function normalizeManualPins(rawPins: unknown = [], doorSegments: DoorSegment[] = []): ManualSectionPin[] {
    const occupiedDoorIndexes = new Set(doorSegments.map((segment) => segment.index));
    const deduped = new Map<number, ManualSectionPin>();

    (Array.isArray(rawPins) ? rawPins : []).forEach((pin, fallbackIndex) => {
        const candidate = toRawManualSectionPin(pin);
        if (!candidate) return;

        const parsedIndex = Number.parseInt(String(candidate.index), 10);
        const index = Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : fallbackIndex;
        if (occupiedDoorIndexes.has(index)) return;
        deduped.set(index, {
            index,
            size: normalizeSectionSize(candidate.size)
        });
    });

    return [...deduped.values()].sort((a, b) => a.index - b.index);
}

function buildOccupiedEntries(doorSegments: DoorSegment[], sectionPins: ManualSectionPin[]): OccupiedEntry[] {
    return [
        ...doorSegments.map((segment) => ({
            index: segment.index,
            kind: 'door' as const,
            value: `${DOOR_LABEL} ${segment.size}` as SketchSectionEntry,
            size: segment.size
        })),
        ...sectionPins.map((pin) => ({
            index: pin.index,
            kind: 'section' as const,
            value: pin.size as SketchSectionEntry,
            size: pin.size
        }))
    ].sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        if (a.kind === b.kind) return 0;
        return a.kind === 'door' ? -1 : 1;
    });
}

function rebuildSequenceWithOccupiedEntries(
    freeSections: number[],
    occupiedEntries: OccupiedEntry[]
): SketchSectionEntry[] {
    const result: SketchSectionEntry[] = [];
    let freeIndex = 0;

    occupiedEntries.forEach((entry) => {
        while (result.length < entry.index && freeIndex < freeSections.length) {
            result.push(freeSections[freeIndex++]);
        }
        result.push(entry.value);
    });

    while (freeIndex < freeSections.length) {
        result.push(freeSections[freeIndex++]);
    }

    return result;
}

function solveEdge(totalLength: number, options: SolveEdgeOptions = {}): SolveEdgeResult {
    const mode = normalizeMode(options.prioMode);
    const targetLength = normalizeNumber(options.targetLength, { fallback: 1500, min: 700, max: 2000 });
    const normalizedTotal = Math.max(0, roundToStep(totalLength, STEP_MM));
    const doorSegments = normalizeDoorSegments(options.doorSegments);
    const sectionPins = normalizeManualPins(options.sectionPins, doorSegments);
    const rawSectionCount = options.sectionCount;
    const hasSectionCount = Number.isFinite(rawSectionCount) && Number(rawSectionCount) > 0;

    if (normalizedTotal === 0) {
        return {
            sections: [],
            valid: true,
            requestedDoorSize: null,
            resolvedDoorSize: null,
            autoAdjusted: false,
            errorCode: null
        };
    }

    const occupiedEntries = buildOccupiedEntries(doorSegments, sectionPins);
    const reservedLength = occupiedEntries.reduce((sum, entry) => sum + entry.size, 0);
    const remaining = normalizedTotal - reservedLength;

    if (remaining < 0) {
        return {
            sections: [],
            valid: false,
            requestedDoorSize: null,
            resolvedDoorSize: null,
            autoAdjusted: false,
            errorCode: doorSegments.length > 0 ? 'NO_DOOR_COMBINATION' : 'NO_SECTION_SOLUTION'
        };
    }

    const freeTargetCount = hasSectionCount
        ? Math.max(0, Number(rawSectionCount) - occupiedEntries.length)
        : undefined;
    const freeSections = solveExactFill(remaining, mode, targetLength, freeTargetCount);
    if (!freeSections && remaining !== 0) {
        const baseErrorCode = doorSegments.length > 0 ? 'NO_DOOR_COMBINATION' : 'NO_SECTION_SOLUTION';
        return {
            sections: [],
            valid: false,
            requestedDoorSize: null,
            resolvedDoorSize: null,
            autoAdjusted: false,
            errorCode: hasSectionCount ? 'WRONG_COUNT' : baseErrorCode
        };
    }

    return {
        sections: rebuildSequenceWithOccupiedEntries(freeSections || [], occupiedEntries),
        valid: true,
        requestedDoorSize: null,
        resolvedDoorSize: null,
        autoAdjusted: false,
        errorCode: null
    };
}

/**
 * Calculates the best combination of glass sections to fill a given length.
 * Preserved for compatibility: returns only section output.
 */
export function calculateSectionsForEdge(
    totalLength: number,
    needsDoor = false,
    options: SolveEdgeOptions = {}
): SketchSectionEntry[] {
    if (needsDoor) {
        const doorSize = normalizeDoorSize(options.doorSize);
        return solveEdge(totalLength, {
            ...options,
            doorSegments: [{ index: 0, size: doorSize }]
        }).sections;
    }

    return solveEdge(totalLength, options).sections;
}

/**
 * Resolves a section array for an edge given a set of manually pinned sections.
 * Each pin is { index: number, size: number }.
 * Returns a new sections array with pinned sizes honoured and the remaining
 * budget re-distributed using the standard DP solver.
 * Returns null if the pinned sizes exceed the edge length or leave a gap that
 * cannot be solved.
 */
export function resolveEdgeWithPins(
    totalLength: number,
    _existingSections: SketchSectionEntry[],
    pins: ManualSectionPin[],
    options: SolveEdgeOptions = {}
): SketchSectionEntry[] {
    return solveEdge(totalLength, {
        ...options,
        sectionPins: pins
    }).sections;
}

function parseSection(section: SketchSectionEntry): { kind: 'door' | 'section'; length: number; raw: SketchSectionEntry } {
    const doorMatch = new RegExp(`${DOOR_LABEL}\\s+(\\d+)`, 'i').exec(String(section));
    if (doorMatch) {
        return {
            kind: 'door',
            length: Number.parseInt(doorMatch[1], 10),
            raw: section
        };
    }
    const parsed = Number(section);
    return {
        kind: 'section',
        length: Number.isFinite(parsed) ? parsed : 0,
        raw: section
    };
}

function normalizeDoorSegmentsByEdge(
    rawDoorSegmentsByEdge: unknown,
    legacyDoorEdges: unknown,
    legacyDoorSizeByEdge: unknown,
    includeBack: boolean,
    enabledEdges: Record<SketchEdgeKey, boolean>
): DoorSegmentsByEdge {
    const normalized: DoorSegmentsByEdge = {};
    const rawRecord = toRawDoorSegmentsByEdge(rawDoorSegmentsByEdge);
    const hasNewModel = Object.keys(rawRecord).length > 0;

    EDGE_KEYS.forEach((edge) => {
        if (!enabledEdges[edge]) return;

        if (hasNewModel) {
            const segments = normalizeDoorSegments(rawRecord[edge]);
            if (segments.length > 0) {
                normalized[edge] = segments;
            }
            return;
        }

        const legacyEdges =
            legacyDoorEdges instanceof Set
                ? legacyDoorEdges
                : new Set(Array.isArray(legacyDoorEdges) ? legacyDoorEdges : []);
        if (edge === 'back' && !includeBack) legacyEdges.delete('back');
        if (!legacyEdges.has(edge)) return;

        const sizeMap = toRawDoorSizeByEdge(legacyDoorSizeByEdge);
        normalized[edge] = [{
            index: 0,
            size: normalizeDoorSize(sizeMap[edge] ?? 1000)
        }];
    });

    return normalized;
}

function normalizeManualSectionsByEdge(
    rawManualSectionsByEdge: unknown,
    doorSegmentsByEdge: DoorSegmentsByEdge
): ManualSectionsByEdge {
    const normalized: ManualSectionsByEdge = {};
    const rawRecord = toRawManualSectionsByEdge(rawManualSectionsByEdge);

    EDGE_KEYS.forEach((edge) => {
        const pins = normalizeManualPins(rawRecord[edge], doorSegmentsByEdge[edge] || []);
        if (pins.length > 0) {
            normalized[edge] = pins;
        }
    });

    return normalized;
}

function normalizeSectionCountByEdge(
    rawCounts: unknown,
    enabledEdges: Record<SketchEdgeKey, boolean>
): SectionCountByEdge {
    const normalized: SectionCountByEdge = {};
    const record = toRawSectionCountByEdge(rawCounts);
    EDGE_KEYS.forEach((edge) => {
        if (!enabledEdges[edge]) return;
        const parsed = Number.parseInt(String(record[edge]), 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            normalized[edge] = parsed;
        }
    });

    return normalized;
}

function determineWarningLevel(diagnostics: EdgeDiagnostic): LayoutWarningLevel {
    if (!diagnostics.valid) return 'critical';
    if (diagnostics.autoAdjusted) return 'warning';
    return 'none';
}

function buildNearestLengthSuggestion(
    requestedLength: number,
    doorSegments: DoorSegment[],
    sectionPins: ManualSectionPin[],
    mode: SketchPriorityMode,
    targetLength: number,
    edgeKey: SketchEdgeKey,
    sectionCount?: number | null
): number | null {
    const maxDelta = 5000;
    const minRequestedLength = getEdgeRequestedMin(edgeKey);

    for (let delta = STEP_MM; delta <= maxDelta; delta += STEP_MM) {
        const candidates = [requestedLength - delta, requestedLength + delta];
        for (const candidateRequested of candidates) {
            if (candidateRequested < minRequestedLength) continue;

            const candidateEffective = computeEdgeEffectiveLength(edgeKey, candidateRequested);
            const candidateSolver = computeEdgeSolverLength(edgeKey, candidateEffective);

            const solved = solveEdge(candidateSolver, {
                prioMode: mode,
                targetLength,
                doorSegments,
                sectionPins,
                sectionCount
            });

            if (solved.valid) {
                return candidateRequested;
            }
        }
    }

    return null;
}

function findDoorAdjustmentSuggestion(
    edgeKey: SketchEdgeKey,
    lengths: { requested: number; effective: number; solver: number },
    doorSegments: DoorSegment[],
    sectionPins: ManualSectionPin[],
    mode: SketchPriorityMode,
    targetLength: number,
    sectionCount?: number | null
): Extract<LayoutSuggestion, { type: 'setDoorSegmentSize' }> | null {
    for (const segment of doorSegments) {
        for (const candidateSize of DOOR_SIZES.filter((size) => size < segment.size)) {
            const updatedSegments = doorSegments.map((entry) =>
                entry.index === segment.index ? { ...entry, size: candidateSize } : entry
            );
            const solved = solveEdge(lengths.solver, {
                prioMode: mode,
                targetLength,
                doorSegments: updatedSegments,
                sectionPins,
                sectionCount
            });
            if (solved.valid) {
                return {
                    id: `suggestion-${edgeKey}-set-door-${segment.index}-${candidateSize}`,
                    type: 'setDoorSegmentSize',
                    edge: edgeKey,
                    index: segment.index,
                    value: candidateSize,
                    priority: 'high',
                    text: `Byt dörr på ${EDGE_LENGTH_LABEL[edgeKey]} till ${candidateSize} mm.`
                };
            }
        }
    }

    return null;
}

function buildNearestCountSuggestions(
    edgeKey: SketchEdgeKey,
    lengths: { requested: number; effective: number; solver: number },
    doorSegments: DoorSegment[],
    sectionPins: ManualSectionPin[],
    mode: SketchPriorityMode,
    targetLength: number,
    requestedCount: number
): Extract<LayoutSuggestion, { type: 'setSectionCount' }>[] {
    const suggestions: Extract<LayoutSuggestion, { type: 'setSectionCount' }>[] = [];
    const maxDelta = 10;

    for (let delta = 1; delta <= maxDelta; delta += 1) {
        for (const candidateCount of [requestedCount - delta, requestedCount + delta]) {
            if (candidateCount < 1) continue;

            const solved = solveEdge(lengths.solver, {
                prioMode: mode,
                targetLength,
                doorSegments,
                sectionPins,
                sectionCount: candidateCount
            });
            if (solved.valid) {
                suggestions.push({
                    id: `suggestion-${edgeKey}-set-count-${candidateCount}`,
                    type: 'setSectionCount',
                    edge: edgeKey,
                    value: candidateCount,
                    priority: 'high',
                    text: `Ändra antal sektioner på ${EDGE_LENGTH_LABEL[edgeKey]} till ${candidateCount} st.`
                });
                if (suggestions.length >= 2) return suggestions;
            }
        }
    }

    return suggestions;
}

function buildEdgeWarningsAndSuggestions(
    edgeKey: SketchEdgeKey,
    lengths: { requested: number; effective: number; solver: number },
    doorSegments: DoorSegment[],
    sectionPins: ManualSectionPin[],
    diagnostics: EdgeDiagnostic,
    mode: SketchPriorityMode,
    targetLength: number,
    sectionCount?: number | null
): { warningLevel: LayoutWarningLevel; warnings: LayoutWarning[]; suggestions: LayoutSuggestion[] } {
    const edgeRequestedLength = lengths.requested;
    const hasSectionCount = Number.isFinite(sectionCount) && Number(sectionCount) > 0;
    const warnings: LayoutWarning[] = [];
    const suggestions: LayoutSuggestion[] = [];
    const warningLevel = determineWarningLevel(diagnostics);
    const hasDoors = doorSegments.length > 0;

    if (!diagnostics.valid) {
        let errorText: string;
        if (diagnostics.errorCode === 'WRONG_COUNT') {
            errorText = `Kan inte fylla ${EDGE_LENGTH_LABEL[edgeKey]} med exakt ${sectionCount} sektioner.`;
        } else if (hasDoors && diagnostics.errorCode === 'NO_DOOR_COMBINATION') {
            errorText = `Ingen giltig kombination hittades för ${EDGE_LENGTH_LABEL[edgeKey]} med vald dörrstorlek.`;
        } else {
            errorText = `Ingen giltig sektionskombination hittades för ${EDGE_LENGTH_LABEL[edgeKey]}.`;
        }

        warnings.push({
            id: `warning-${edgeKey}-${diagnostics.errorCode || 'invalid'}`,
            level: 'critical',
            code: diagnostics.errorCode || 'EDGE_INVALID',
            edge: edgeKey,
            text: errorText
        });

        if (hasSectionCount && diagnostics.errorCode === 'WRONG_COUNT') {
            const countSuggestions = buildNearestCountSuggestions(
                edgeKey,
                lengths,
                doorSegments,
                sectionPins,
                mode,
                targetLength,
                Number(sectionCount)
            );
            suggestions.push(...countSuggestions);
            suggestions.push({
                id: `suggestion-${edgeKey}-clear-count`,
                type: 'clearSectionCount',
                edge: edgeKey,
                priority: 'medium',
                text: `Ta bort manuellt antal på ${EDGE_LENGTH_LABEL[edgeKey]} (låt beräknas automatiskt).`
            });
        }

        const nearestLength = buildNearestLengthSuggestion(
            edgeRequestedLength,
            doorSegments,
            sectionPins,
            mode,
            targetLength,
            edgeKey,
            sectionCount
        );
        const dimensionKey = EDGE_TO_DIMENSION[edgeKey];
        if (Number.isFinite(nearestLength) && nearestLength !== edgeRequestedLength) {
            suggestions.push({
                id: `suggestion-${edgeKey}-set-length-${nearestLength}`,
                type: 'setDimension',
                edge: edgeKey,
                dimension: dimensionKey,
                value: nearestLength,
                priority: 'high',
                text: `Ändra ${dimensionKey === 'width' ? 'bredd' : 'djup'} till ${nearestLength} mm för att lösa ${EDGE_LENGTH_LABEL[edgeKey]}.`
            });
        }

        if (hasDoors) {
            const sizeSuggestion = findDoorAdjustmentSuggestion(
                edgeKey,
                lengths,
                doorSegments,
                sectionPins,
                mode,
                targetLength,
                sectionCount
            );
            if (sizeSuggestion) {
                suggestions.push(sizeSuggestion);
            }

            suggestions.push({
                id: `suggestion-${edgeKey}-remove-door-${doorSegments[0].index}`,
                type: 'removeDoorSegment',
                edge: edgeKey,
                index: doorSegments[0].index,
                priority: 'medium',
                text: `Ta bort dörr på ${EDGE_LENGTH_LABEL[edgeKey]}.`
            });
        }
    } else if (diagnostics.autoAdjusted) {
        warnings.push({
            id: `warning-${edgeKey}-door-auto-adjusted`,
            level: 'warning',
            code: 'DOOR_AUTO_ADJUSTED',
            edge: edgeKey,
            text: `Dörrstorlek på ${EDGE_LENGTH_LABEL[edgeKey]} justerades automatiskt ${diagnostics.requestedDoorSize} -> ${diagnostics.resolvedDoorSize} mm.`
        });

        suggestions.push({
            id: `suggestion-${edgeKey}-confirm-door-${doorSegments[0]?.index ?? 0}-${diagnostics.resolvedDoorSize}`,
            type: 'setDoorSegmentSize',
            edge: edgeKey,
            index: doorSegments[0]?.index ?? 0,
            value: diagnostics.resolvedDoorSize ?? normalizeDoorSize(undefined),
            priority: 'low',
            text: `Bekräfta ${diagnostics.resolvedDoorSize} mm som standarddörr för ${EDGE_LENGTH_LABEL[edgeKey]}.`
        });
    }

    return {
        warningLevel,
        warnings,
        suggestions
    };
}

function buildEdgeSummary(
    edgeKey: SketchEdgeKey,
    lengths: { requested: number; effective: number; solver: number },
    geometry: EdgeGeometry,
    enabled: boolean,
    sections: SketchSectionEntry[],
    diagnostics: EdgeDiagnostic
): EdgeSummary {
    const segmentData: SketchRenderedSegment[] = sections.map((segment, index) => {
        const parsed = parseSection(segment);
        const isDoor = parsed.kind === 'door';
        return {
            index,
            key: `${edgeKey}-${index}-${String(parsed.raw)}`,
            type: parsed.kind,
            length: parsed.length,
            label: isDoor ? `${DOOR_LABEL} ${parsed.length}` : `${parsed.length}`,
            isDoor
        };
    });

    return {
        edge: edgeKey,
        enabled,
        requestedLength: lengths.requested,
        effectiveLength: lengths.effective,
        solverLength: lengths.solver,
        setbackMm: geometry.setbackMm,
        leadingPostMm: geometry.leadingPostMm,
        valid: diagnostics.valid,
        warningLevel: determineWarningLevel(diagnostics),
        requestedDoorSize: diagnostics.requestedDoorSize,
        resolvedDoorSize: diagnostics.resolvedDoorSize,
        autoAdjusted: diagnostics.autoAdjusted,
        errorCode: diagnostics.errorCode,
        segments: segmentData,
        sectionCount: segmentData.filter((segment) => !segment.isDoor).length,
        doorCount: segmentData.filter((segment) => segment.isDoor).length
    };
}

export function computeLayout(config: SketchConfigInput = {}): ComputedLayoutResult {
    const includeBack = !!config.includeBack;
    const prioMode = normalizeMode(config.prioMode);
    const targetLength = normalizeNumber(config.targetLength, { fallback: 1500, min: 700, max: 2000 });

    const requestedDimensions = {
        width: computeEdgeRequestedLength('front', config),
        depth: normalizeNumber(config.depth ?? config.depthLeft ?? config.depthRight, { fallback: 3000, min: 0, max: 50000 }),
        depthLeft: computeEdgeRequestedLength('left', config),
        depthRight: computeEdgeRequestedLength('right', config)
    };
    requestedDimensions.depth = config.equalDepth ? requestedDimensions.depthLeft : requestedDimensions.depth;

    const width = requestedDimensions.width;
    const depthLeft = requestedDimensions.depthLeft;
    const depthRight = config.equalDepth ? requestedDimensions.depthLeft : requestedDimensions.depthRight;
    const sideEdgesPresent = Math.max(depthLeft, depthRight) > 0;

    const edges: Record<
        SketchEdgeKey,
        { requestedLength: number; effectiveLength: number; solverLength: number; geometry: EdgeGeometry; enabled: boolean }
    > = {
        front: { requestedLength: 0, effectiveLength: 0, solverLength: 0, geometry: { setbackMm: 0, leadingPostMm: 0 }, enabled: true },
        left: { requestedLength: 0, effectiveLength: 0, solverLength: 0, geometry: { setbackMm: 0, leadingPostMm: 0 }, enabled: false },
        right: { requestedLength: 0, effectiveLength: 0, solverLength: 0, geometry: { setbackMm: 0, leadingPostMm: 0 }, enabled: false },
        back: { requestedLength: 0, effectiveLength: 0, solverLength: 0, geometry: { setbackMm: 0, leadingPostMm: 0 }, enabled: false }
    };

    EDGE_KEYS.forEach((edgeKey) => {
        const requestedLength =
            edgeKey === 'front' || edgeKey === 'back'
                ? width
                : edgeKey === 'left'
                    ? depthLeft
                    : depthRight;

        const effectiveLength = computeEdgeEffectiveLength(edgeKey, requestedLength);
        const solverLength = computeEdgeSolverLength(edgeKey, effectiveLength);
        const geometry = computeEdgeGeometry(edgeKey, requestedLength, effectiveLength, solverLength);

        edges[edgeKey] = {
            requestedLength,
            effectiveLength,
            solverLength,
            geometry,
            enabled:
                edgeKey === 'front'
                    ? true
                    : edgeKey === 'back'
                        ? includeBack && sideEdgesPresent
                        : requestedLength > 0
        };
    });

    const enabledEdges = EDGE_KEYS.reduce<Record<SketchEdgeKey, boolean>>((acc, edgeKey) => {
        acc[edgeKey] = edges[edgeKey].enabled;
        return acc;
    }, { front: true, left: false, right: false, back: false });

    const doorSegmentsByEdge = normalizeDoorSegmentsByEdge(
        config.doorSegmentsByEdge,
        config.doorEdges,
        config.doorSizeByEdge,
        includeBack,
        enabledEdges
    );
    const manualSectionsByEdge = normalizeManualSectionsByEdge(config.manualSectionsByEdge, doorSegmentsByEdge);
    const sectionCountByEdge = normalizeSectionCountByEdge(config.sectionCountByEdge, enabledEdges);

    function solveNamedEdge(
        edgeKey: SketchEdgeKey,
        lengths: { requested: number; effective: number; solver: number },
        enabled: boolean
    ) {
        if (!enabled) {
            const diagnostics: EdgeDiagnostic = {
                valid: true,
                requestedDoorSize: null,
                resolvedDoorSize: null,
                autoAdjusted: false,
                errorCode: null
            };
            return {
                sections: [] as SketchSectionEntry[],
                diagnostics,
                warningLevel: determineWarningLevel(diagnostics),
                warnings: [] as LayoutWarning[],
                suggestions: [] as LayoutSuggestion[]
            };
        }

        const doorSegments = doorSegmentsByEdge[edgeKey] || [];
        const sectionPins = manualSectionsByEdge[edgeKey] || [];
        const edgeSectionCount = sectionCountByEdge[edgeKey];
        const edgeResult = solveEdge(lengths.solver, {
            prioMode,
            targetLength,
            doorSegments,
            sectionPins,
            sectionCount: edgeSectionCount
        });

        const diagnostics: EdgeDiagnostic = {
            valid: edgeResult.valid,
            requestedDoorSize: edgeResult.requestedDoorSize,
            resolvedDoorSize: edgeResult.resolvedDoorSize,
            autoAdjusted: edgeResult.autoAdjusted,
            errorCode: edgeResult.errorCode
        };

        const { warningLevel, warnings, suggestions } = buildEdgeWarningsAndSuggestions(
            edgeKey,
            lengths,
            doorSegments,
            sectionPins,
            diagnostics,
            prioMode,
            targetLength,
            edgeSectionCount
        );

        return {
            sections: edgeResult.sections,
            diagnostics,
            warningLevel,
            warnings,
            suggestions
        };
    }

    const left = solveNamedEdge(
        'left',
        { requested: edges.left.requestedLength, effective: edges.left.effectiveLength, solver: edges.left.solverLength },
        edges.left.enabled
    );
    const right = solveNamedEdge(
        'right',
        { requested: edges.right.requestedLength, effective: edges.right.effectiveLength, solver: edges.right.solverLength },
        edges.right.enabled
    );
    const front = solveNamedEdge(
        'front',
        { requested: edges.front.requestedLength, effective: edges.front.effectiveLength, solver: edges.front.solverLength },
        edges.front.enabled
    );
    const back = solveNamedEdge(
        'back',
        { requested: edges.back.requestedLength, effective: edges.back.effectiveLength, solver: edges.back.solverLength },
        edges.back.enabled
    );

    const leftEdge = left.sections;
    const rightEdge = right.sections;
    const frontEdge = front.sections;
    const backEdge = back.sections;

    const edgeDiagnostics: Record<SketchEdgeKey, EdgeDiagnostic> = {
        left: left.diagnostics,
        right: right.diagnostics,
        front: front.diagnostics,
        back: back.diagnostics
    };
    const hasInvalidEdges = Object.values(edgeDiagnostics).some((diag) => !diag.valid);

    const edgeSummaries: Record<SketchEdgeKey, EdgeSummary> = {
        left: buildEdgeSummary(
            'left',
            { requested: depthLeft, effective: edges.left.effectiveLength, solver: edges.left.solverLength },
            edges.left.geometry,
            edges.left.enabled,
            leftEdge,
            left.diagnostics
        ),
        right: buildEdgeSummary(
            'right',
            { requested: depthRight, effective: edges.right.effectiveLength, solver: edges.right.solverLength },
            edges.right.geometry,
            edges.right.enabled,
            rightEdge,
            right.diagnostics
        ),
        front: buildEdgeSummary(
            'front',
            { requested: width, effective: edges.front.effectiveLength, solver: edges.front.solverLength },
            edges.front.geometry,
            edges.front.enabled,
            frontEdge,
            front.diagnostics
        ),
        back: buildEdgeSummary(
            'back',
            { requested: width, effective: edges.back.effectiveLength, solver: edges.back.solverLength },
            edges.back.geometry,
            edges.back.enabled,
            backEdge,
            back.diagnostics
        )
    };

    const layoutWarnings: LayoutWarning[] = [];
    const suggestions: LayoutSuggestion[] = [];
    EDGE_KEYS.forEach((edgeKey) => {
        if (!edges[edgeKey].enabled) return;
        const lengths = {
            requested: edges[edgeKey].requestedLength,
            effective: edges[edgeKey].effectiveLength,
            solver: edges[edgeKey].solverLength
        };

        const info = buildEdgeWarningsAndSuggestions(
            edgeKey,
            lengths,
            doorSegmentsByEdge[edgeKey] || [],
            manualSectionsByEdge[edgeKey] || [],
            edgeDiagnostics[edgeKey],
            prioMode,
            targetLength,
            sectionCountByEdge[edgeKey]
        );

        layoutWarnings.push(...info.warnings);
        suggestions.push(...info.suggestions);
        edgeSummaries[edgeKey].warningLevel = info.warningLevel;
    });

    const allSections = [...leftEdge, ...rightEdge, ...frontEdge, ...backEdge];
    const doorCount = allSections.filter((section) => String(section).includes(DOOR_LABEL)).length;
    const slimlineCount = doorCount;

    let stodbenCount = 0;
    if (!includeBack && allSections.length > 0) {
        if (depthLeft <= 0) stodbenCount += 1;
        if (depthRight <= 0) stodbenCount += 1;
    }

    const counts: Record<string, number> = {};
    let totalGlassLength = 0;
    allSections.forEach((section) => {
        const key = String(section);
        counts[key] = (counts[key] || 0) + 1;
        const parsed = parseSection(section);
        totalGlassLength += parsed.length;
    });

    return {
        requestedDimensions,
        effectiveDimensions: {
            front: edges.front.effectiveLength,
            back: edges.back.effectiveLength,
            left: edges.left.effectiveLength,
            right: edges.right.effectiveLength
        },
        solverDimensions: {
            front: edges.front.solverLength,
            back: edges.back.solverLength,
            left: edges.left.solverLength,
            right: edges.right.solverLength
        },
        edgeGeometry: {
            front: edges.front.geometry,
            back: edges.back.geometry,
            left: edges.left.geometry,
            right: edges.right.geometry
        },
        width,
        depth: Number(config.depth) || 0,
        depthLeft,
        depthRight,
        targetLength,
        doorSegmentsByEdge,
        manualSectionsByEdge,
        sectionCountByEdge,
        leftEdge,
        rightEdge,
        frontEdge,
        backEdge,
        allSections,
        doorCount,
        slimlineCount,
        stodbenCount,
        counts,
        totalGlassLength,
        edgeDiagnostics,
        edgeSummaries,
        layoutWarnings,
        suggestions,
        hasInvalidEdges
    };
}
