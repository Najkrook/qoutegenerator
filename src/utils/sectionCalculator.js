/**
 * Section calculator for ClickitUP outdoor seating layouts.
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

const EDGE_KEYS = ['front', 'left', 'right', 'back'];
const EDGE_TO_DIMENSION = {
    front: 'width',
    back: 'width',
    left: 'depthLeft',
    right: 'depthRight'
};
const EDGE_LENGTH_LABEL = {
    front: 'framkant',
    back: 'bakkant',
    left: 'vänsterkant',
    right: 'högerkant'
};

function getEdgeRequestedMin(edgeKey) {
    return edgeKey === 'left' || edgeKey === 'right' ? 0 : MIN_DIMENSION_MM;
}

export function computeEdgeRequestedLength(edgeKey, config) {
    switch (edgeKey) {
        case 'front': return normalizeNumber(config.width, { fallback: 4000, min: MIN_DIMENSION_MM, max: 20000 });
        case 'back': return normalizeNumber(config.width, { fallback: 4000, min: MIN_DIMENSION_MM, max: 20000 });
        case 'left': return normalizeNumber(config.depthLeft ?? config.depth, { fallback: 3000, min: 0, max: 10000 });
        case 'right': return normalizeNumber(config.depthRight ?? config.depth, { fallback: 3000, min: 0, max: 10000 });
        default: return 0;
    }
}

export function computeEdgeEffectiveLength(edgeKey, requestedLength) {
    if (edgeKey === 'left' || edgeKey === 'right') {
        return Math.max(0, requestedLength - SIDE_NET_REDUCTION_MM);
    }
    return requestedLength;
}

export function computeEdgeSolverLength(edgeKey, effectiveLength) {
    if (edgeKey === 'left' || edgeKey === 'right') {
        return Math.floor(effectiveLength / STEP_MM) * STEP_MM;
    }
    return roundToStep(effectiveLength, STEP_MM);
}

export function computeEdgeGeometry(edgeKey, requestedLength, effectiveLength, solverLength) {
    if (edgeKey === 'left' || edgeKey === 'right') {
        return {
            setbackMm: Math.max(0, requestedLength - effectiveLength),
            leadingPostMm: Math.max(0, effectiveLength - solverLength)
        };
    }
    return { setbackMm: 0, leadingPostMm: 0 };
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function roundToStep(value, step = STEP_MM) {
    return Math.round(value / step) * step;
}

function normalizeNumber(rawValue, { fallback, min, max }) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base, STEP_MM);
    return clamp(rounded, min, max);
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

function normalizeMode(rawMode) {
    if (rawMode === 'convenient' || rawMode === 'target' || rawMode === 'symmetrical') {
        return rawMode;
    }
    return 'symmetrical';
}

function buildMetrics(sections, mode, target) {
    const count = sections.length;
    const spread = count > 1 ? sections[0] - sections[count - 1] : 0;
    const targetPenalty = sections.reduce((sum, size) => sum + Math.abs(size - target), 0);
    return { mode, count, spread, targetPenalty };
}

function isLexicographicallyBetter(a, b) {
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

function isBetterCandidate(candidate, incumbent, mode, target) {
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

function solveExactFill(total, mode, targetLength) {
    if (!Number.isFinite(total) || total < 0) return null;
    if (total === 0) return [];
    if (total < MIN_SECTION_SIZE) return null;
    if (total % STEP_MM !== 0) return null;

    const normalizedTarget = nearestFromList(
        normalizeNumber(targetLength, { fallback: 1500, min: 700, max: 2000 }),
        SECTION_SIZES
    );
    const memo = new Map();

    function walk(remaining, startIdx) {
        if (remaining === 0) return [];
        if (remaining < MIN_SECTION_SIZE) return null;

        const memoKey = `${remaining}|${startIdx}`;
        if (memo.has(memoKey)) return memo.get(memoKey);

        let best = null;
        for (let i = startIdx; i < SECTION_SIZES.length; i += 1) {
            const size = SECTION_SIZES[i];
            if (size > remaining) continue;

            const tail = walk(remaining - size, i);
            if (!tail) continue;

            const candidate = [size, ...tail];
            if (isBetterCandidate(candidate, best, mode, normalizedTarget)) {
                best = candidate;
            }
        }

        memo.set(memoKey, best);
        return best;
    }

    return walk(total, 0);
}

function normalizeDoorSize(rawDoorSize) {
    const value = normalizeNumber(rawDoorSize, { fallback: 1000, min: 700, max: 1100 });
    return nearestFromList(value, DOOR_SIZES);
}

function normalizeSectionSize(rawSectionSize) {
    const value = normalizeNumber(rawSectionSize, { fallback: 1600, min: MIN_SECTION_SIZE, max: 2000 });
    return nearestFromList(value, SECTION_SIZES);
}

function normalizeDoorSegment(rawSegment, fallbackIndex = 0) {
    if (!rawSegment || typeof rawSegment !== 'object') return null;

    const parsedIndex = Number.parseInt(rawSegment.index, 10);
    return {
        index: Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : fallbackIndex,
        size: normalizeDoorSize(rawSegment.size ?? rawSegment.doorSize ?? 1000)
    };
}

function normalizeDoorSegments(rawSegments = []) {
    const deduped = new Map();

    (Array.isArray(rawSegments) ? rawSegments : []).forEach((segment, fallbackIndex) => {
        const normalized = normalizeDoorSegment(segment, fallbackIndex);
        if (!normalized) return;
        deduped.set(normalized.index, normalized);
    });

    return [...deduped.values()].sort((a, b) => a.index - b.index);
}

function normalizeManualPins(rawPins = [], doorSegments = []) {
    const occupiedDoorIndexes = new Set(doorSegments.map((segment) => segment.index));
    const deduped = new Map();

    (Array.isArray(rawPins) ? rawPins : []).forEach((pin, fallbackIndex) => {
        if (!pin || typeof pin !== 'object') return;
        const parsedIndex = Number.parseInt(pin.index, 10);
        const index = Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : fallbackIndex;
        if (occupiedDoorIndexes.has(index)) return;
        deduped.set(index, {
            index,
            size: normalizeSectionSize(pin.size)
        });
    });

    return [...deduped.values()].sort((a, b) => a.index - b.index);
}

function buildOccupiedEntries(doorSegments, sectionPins) {
    return [
        ...doorSegments.map((segment) => ({
            index: segment.index,
            kind: 'door',
            value: `${DOOR_LABEL} ${segment.size}`,
            size: segment.size
        })),
        ...sectionPins.map((pin) => ({
            index: pin.index,
            kind: 'section',
            value: pin.size,
            size: pin.size
        }))
    ].sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        if (a.kind === b.kind) return 0;
        return a.kind === 'door' ? -1 : 1;
    });
}

function rebuildSequenceWithOccupiedEntries(freeSections, occupiedEntries) {
    const result = [];
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

function solveEdge(totalLength, options = {}) {
    const mode = normalizeMode(options.prioMode);
    const targetLength = normalizeNumber(options.targetLength, { fallback: 1500, min: 700, max: 2000 });
    const normalizedTotal = Math.max(0, roundToStep(totalLength, STEP_MM));
    const doorSegments = normalizeDoorSegments(options.doorSegments);
    const sectionPins = normalizeManualPins(options.sectionPins, doorSegments);

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

    const freeSections = solveExactFill(remaining, mode, targetLength);
    if (!freeSections && remaining !== 0) {
        return {
            sections: [],
            valid: false,
            requestedDoorSize: null,
            resolvedDoorSize: null,
            autoAdjusted: false,
            errorCode: doorSegments.length > 0 ? 'NO_DOOR_COMBINATION' : 'NO_SECTION_SOLUTION'
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
export function calculateSectionsForEdge(totalLength, needsDoor = false, options = {}) {
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
export function resolveEdgeWithPins(totalLength, existingSections, pins, options = {}) {
    return solveEdge(totalLength, {
        ...options,
        sectionPins: pins
    }).sections;
}

function parseSection(section) {
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

function normalizeDoorSegmentsByEdge(rawDoorSegmentsByEdge, legacyDoorEdges, legacyDoorSizeByEdge, includeBack, enabledEdges) {
    const normalized = {};
    const hasNewModel = rawDoorSegmentsByEdge && typeof rawDoorSegmentsByEdge === 'object';

    EDGE_KEYS.forEach((edge) => {
        if (!enabledEdges[edge]) return;

        if (hasNewModel) {
            const segments = normalizeDoorSegments(rawDoorSegmentsByEdge[edge]);
            if (segments.length > 0) {
                normalized[edge] = segments;
            }
            return;
        }

        const legacyEdges = legacyDoorEdges instanceof Set ? legacyDoorEdges : new Set(legacyDoorEdges || []);
        if (edge === 'back' && !includeBack) legacyEdges.delete('back');
        if (!legacyEdges.has(edge)) return;
        normalized[edge] = [{
            index: 0,
            size: normalizeDoorSize(legacyDoorSizeByEdge?.[edge] ?? 1000)
        }];
    });

    return normalized;
}

function normalizeManualSectionsByEdge(rawManualSectionsByEdge, doorSegmentsByEdge) {
    const normalized = {};

    EDGE_KEYS.forEach((edge) => {
        const pins = normalizeManualPins(rawManualSectionsByEdge?.[edge], doorSegmentsByEdge[edge] || []);
        if (pins.length > 0) {
            normalized[edge] = pins;
        }
    });

    return normalized;
}

function determineWarningLevel(diagnostics) {
    if (!diagnostics.valid) return 'critical';
    if (diagnostics.autoAdjusted) return 'warning';
    return 'none';
}

function buildNearestLengthSuggestion(requestedLength, doorSegments, sectionPins, mode, targetLength, edgeKey) {
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
                sectionPins
            });

            if (solved.valid) {
                return candidateRequested;
            }
        }
    }

    return null;
}

function findDoorAdjustmentSuggestion(edgeKey, lengths, doorSegments, sectionPins, mode, targetLength) {
    for (const segment of doorSegments) {
        for (const candidateSize of DOOR_SIZES.filter((size) => size < segment.size)) {
            const updatedSegments = doorSegments.map((entry) =>
                entry.index === segment.index ? { ...entry, size: candidateSize } : entry
            );
            const solved = solveEdge(lengths.solver, {
                prioMode: mode,
                targetLength,
                doorSegments: updatedSegments,
                sectionPins
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

function buildEdgeWarningsAndSuggestions(edgeKey, lengths, doorSegments, sectionPins, diagnostics, mode, targetLength) {
    const edgeRequestedLength = lengths.requested;

    const warnings = [];
    const suggestions = [];
    const warningLevel = determineWarningLevel(diagnostics);
    const hasDoors = doorSegments.length > 0;

    if (!diagnostics.valid) {
        const errorText = hasDoors && diagnostics.errorCode === 'NO_DOOR_COMBINATION'
            ? `Ingen giltig kombination hittades för ${EDGE_LENGTH_LABEL[edgeKey]} med vald dörrstorlek.`
            : `Ingen giltig sektionskombination hittades för ${EDGE_LENGTH_LABEL[edgeKey]}.`;

        warnings.push({
            id: `warning-${edgeKey}-${diagnostics.errorCode || 'invalid'}`,
            level: 'critical',
            code: diagnostics.errorCode || 'EDGE_INVALID',
            edge: edgeKey,
            text: errorText
        });

        const nearestLength = buildNearestLengthSuggestion(edgeRequestedLength, doorSegments, sectionPins, mode, targetLength, edgeKey);
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
            const sizeSuggestion = findDoorAdjustmentSuggestion(edgeKey, lengths, doorSegments, sectionPins, mode, targetLength);
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
            value: diagnostics.resolvedDoorSize,
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

function buildEdgeSummary(edgeKey, lengths, geometry, enabled, sections, diagnostics) {
    const segmentData = sections.map((segment, index) => {
        const parsed = parseSection(segment);
        const isDoor = parsed.kind === 'door';
        return {
            index,
            key: `${edgeKey}-${index}-${parsed.raw}`,
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

export function computeLayout(config = {}) {
    const includeBack = !!config.includeBack;
    const prioMode = normalizeMode(config.prioMode);
    const targetLength = normalizeNumber(config.targetLength, { fallback: 1500, min: 700, max: 2000 });

    const requestedDimensions = {
        width: computeEdgeRequestedLength('front', config),
        depthLeft: computeEdgeRequestedLength('left', config),
        depthRight: computeEdgeRequestedLength('right', config)
    };
    requestedDimensions.depth = config.equalDepth ? requestedDimensions.depthLeft : config.depth;

    const width = requestedDimensions.width;
    const depthLeft = requestedDimensions.depthLeft;
    const depthRight = config.equalDepth ? requestedDimensions.depthLeft : requestedDimensions.depthRight;
    const sideEdgesPresent = Math.max(depthLeft, depthRight) > 0;

    function solveNamedEdge(edgeKey, lengths, enabled) {
        if (!enabled) {
            return {
                sections: [],
                diagnostics: {
                    valid: true,
                    requestedDoorSize: null,
                    resolvedDoorSize: null,
                    autoAdjusted: false,
                    errorCode: null
                }
            };
        }

        const doorSegments = doorSegmentsByEdge[edgeKey] || [];
        const sectionPins = manualSectionsByEdge[edgeKey] || [];
        const edgeResult = solveEdge(lengths.solver, {
            prioMode,
            targetLength,
            doorSegments,
            sectionPins
        });

        const diagnostics = {
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
            targetLength
        );

        return {
            sections: edgeResult.sections,
            diagnostics,
            warningLevel,
            warnings,
            suggestions
        };
    }

    const edges = {};
    EDGE_KEYS.forEach(edgeKey => {
        const requestedLength =
            edgeKey === 'front' || edgeKey === 'back' ? width :
                edgeKey === 'left' ? depthLeft : depthRight;

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

    const enabledEdges = EDGE_KEYS.reduce((acc, edgeKey) => {
        acc[edgeKey] = edges[edgeKey].enabled;
        return acc;
    }, {});

    const doorSegmentsByEdge = normalizeDoorSegmentsByEdge(
        config.doorSegmentsByEdge,
        config.doorEdges,
        config.doorSizeByEdge,
        includeBack,
        enabledEdges
    );
    const manualSectionsByEdge = normalizeManualSectionsByEdge(config.manualSectionsByEdge, doorSegmentsByEdge);

    const left = solveNamedEdge('left', { requested: edges.left.requestedLength, effective: edges.left.effectiveLength, solver: edges.left.solverLength }, edges.left.enabled);
    const right = solveNamedEdge('right', { requested: edges.right.requestedLength, effective: edges.right.effectiveLength, solver: edges.right.solverLength }, edges.right.enabled);
    const front = solveNamedEdge('front', { requested: edges.front.requestedLength, effective: edges.front.effectiveLength, solver: edges.front.solverLength }, edges.front.enabled);
    const back = solveNamedEdge('back', { requested: edges.back.requestedLength, effective: edges.back.effectiveLength, solver: edges.back.solverLength }, edges.back.enabled);

    const leftEdge = left.sections;
    const rightEdge = right.sections;
    const frontEdge = front.sections;
    const backEdge = back.sections;

    const edgeDiagnostics = {
        left: left.diagnostics,
        right: right.diagnostics,
        front: front.diagnostics,
        back: back.diagnostics
    };
    const hasInvalidEdges = Object.values(edgeDiagnostics).some((diag) => !diag.valid);

    const edgeSummaries = {
        left: buildEdgeSummary('left', { requested: depthLeft, effective: edges.left.effectiveLength, solver: edges.left.solverLength }, edges.left.geometry, edges.left.enabled, leftEdge, left.diagnostics),
        right: buildEdgeSummary('right', { requested: depthRight, effective: edges.right.effectiveLength, solver: edges.right.solverLength }, edges.right.geometry, edges.right.enabled, rightEdge, right.diagnostics),
        front: buildEdgeSummary('front', { requested: width, effective: edges.front.effectiveLength, solver: edges.front.solverLength }, edges.front.geometry, edges.front.enabled, frontEdge, front.diagnostics),
        back: buildEdgeSummary('back', { requested: width, effective: edges.back.effectiveLength, solver: edges.back.solverLength }, edges.back.geometry, edges.back.enabled, backEdge, back.diagnostics)
    };

    const layoutWarnings = [];
    const suggestions = [];
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
            targetLength
        );

        layoutWarnings.push(...info.warnings);
        suggestions.push(...info.suggestions);
        edgeSummaries[edgeKey].warningLevel = info.warningLevel;
    });

    const allSections = [...leftEdge, ...rightEdge, ...frontEdge, ...backEdge];
    const doorCount = allSections.filter((section) => String(section).includes(DOOR_LABEL)).length;
    const slimlineCount = doorCount;
    const stodbenCount = includeBack ? 0 : 2;

    const counts = {};
    let totalGlassLength = 0;
    allSections.forEach((section) => {
        counts[section] = (counts[section] || 0) + 1;
        if (typeof section === 'number') totalGlassLength += section;
    });

    return {
        requestedDimensions,
        effectiveDimensions: {
            front: edges.front.effectiveLength,
            back: edges.back.effectiveLength,
            left: edges.left.effectiveLength,
            right: edges.right.effectiveLength,
        },
        solverDimensions: {
            front: edges.front.solverLength,
            back: edges.back.solverLength,
            left: edges.left.solverLength,
            right: edges.right.solverLength,
        },
        edgeGeometry: {
            front: edges.front.geometry,
            back: edges.back.geometry,
            left: edges.left.geometry,
            right: edges.right.geometry,
        },
        width,
        depth: config.depth, // Raw config depth for backcompat in some parts of UI
        depthLeft,
        depthRight,
        targetLength,
        doorSegmentsByEdge,
        manualSectionsByEdge,
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
