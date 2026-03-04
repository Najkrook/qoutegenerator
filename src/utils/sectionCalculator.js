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

function doorCandidatesFromRequested(requestedDoorSize) {
    return DOOR_SIZES.filter((size) => size <= requestedDoorSize);
}

function solveEdgeWithFixedDoor(totalLength, doorSize, mode, targetLength) {
    const normalizedTotal = Math.max(0, roundToStep(totalLength, STEP_MM));
    if (normalizedTotal < doorSize) return null;
    const remaining = normalizedTotal - doorSize;
    const sectionSolution = solveExactFill(remaining, mode, targetLength);
    if (!sectionSolution) return null;
    return [`${DOOR_LABEL} ${doorSize}`, ...sectionSolution];
}

function solveEdge(totalLength, needsDoor, options = {}) {
    const mode = normalizeMode(options.prioMode);
    const targetLength = normalizeNumber(options.targetLength, { fallback: 1500, min: 700, max: 2000 });
    const normalizedTotal = Math.max(0, roundToStep(totalLength, STEP_MM));

    if (normalizedTotal === 0) {
        return {
            sections: [],
            valid: false,
            requestedDoorSize: null,
            resolvedDoorSize: null,
            autoAdjusted: false,
            errorCode: 'NON_POSITIVE_EDGE'
        };
    }

    if (!needsDoor) {
        const sectionSolution = solveExactFill(normalizedTotal, mode, targetLength);
        if (!sectionSolution) {
            return {
                sections: [],
                valid: false,
                requestedDoorSize: null,
                resolvedDoorSize: null,
                autoAdjusted: false,
                errorCode: 'NO_SECTION_SOLUTION'
            };
        }

        return {
            sections: sectionSolution,
            valid: true,
            requestedDoorSize: null,
            resolvedDoorSize: null,
            autoAdjusted: false,
            errorCode: null
        };
    }

    const requestedDoorSize = normalizeDoorSize(options.doorSize);
    const candidates = doorCandidatesFromRequested(requestedDoorSize);

    for (const doorSize of candidates) {
        const sectionSolution = solveEdgeWithFixedDoor(normalizedTotal, doorSize, mode, targetLength);
        if (!sectionSolution) continue;

        return {
            sections: sectionSolution,
            valid: true,
            requestedDoorSize,
            resolvedDoorSize: doorSize,
            autoAdjusted: doorSize !== requestedDoorSize,
            errorCode: null
        };
    }

    return {
        sections: [],
        valid: false,
        requestedDoorSize,
        resolvedDoorSize: null,
        autoAdjusted: false,
        errorCode: 'NO_DOOR_COMBINATION'
    };
}

/**
 * Calculates the best combination of glass sections to fill a given length.
 * Preserved for compatibility: returns only section output.
 */
export function calculateSectionsForEdge(totalLength, needsDoor = false, options = {}) {
    return solveEdge(totalLength, needsDoor, options).sections;
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
    if (!pins || pins.length === 0) {
        // No overrides — just re-solve normally
        return solveEdge(totalLength, false, options).sections;
    }

    const mode = normalizeMode(options.prioMode);
    const targetLength = normalizeNumber(options.targetLength, { fallback: 1500, min: 700, max: 2000 });
    const normalizedTotal = Math.max(0, roundToStep(totalLength, STEP_MM));

    // Build the pinned size map
    const pinnedMap = new Map();
    pins.forEach(({ index, size }) => pinnedMap.set(index, size));

    // The total number of sections we expect (keep same count as before)
    const existingCount = existingSections.filter((s) => !String(s).includes(DOOR_LABEL)).length;
    const totalPinnedSize = [...pinnedMap.values()].reduce((sum, s) => sum + s, 0);
    const remainingBudget = normalizedTotal - totalPinnedSize;

    // Number of free slots we need to fill
    const freeSlotsCount = existingCount - pinnedMap.size;

    if (freeSlotsCount < 0 || remainingBudget < 0) return null;

    // If all slots are pinned, just splice them together
    if (freeSlotsCount === 0) {
        if (remainingBudget !== 0) return null;
        const result = [];
        for (let i = 0; i < existingCount; i++) {
            result.push(pinnedMap.get(i) ?? 0);
        }
        return result;
    }

    // Solve the remaining budget for the free slots
    const solvedFree = solveExactFill(remainingBudget, mode, targetLength);
    if (!solvedFree || solvedFree.length !== freeSlotsCount) return null;

    // Splice pinned and free sections back together in order
    const result = [];
    let freeIdx = 0;
    for (let i = 0; i < existingCount; i++) {
        if (pinnedMap.has(i)) {
            result.push(pinnedMap.get(i));
        } else {
            result.push(solvedFree[freeIdx++]);
        }
    }

    return result;
}

function normalizeDoorEdges(rawDoorEdges, includeBack) {
    const edges = rawDoorEdges instanceof Set ? new Set(rawDoorEdges) : new Set(rawDoorEdges || []);
    if (!includeBack) edges.delete('back');
    return edges;
}

function normalizeDoorSizeByEdge(rawDoorSizeByEdge, doorEdges, fallbackDoorSize) {
    const source = rawDoorSizeByEdge || {};
    const normalized = {};

    EDGE_KEYS.forEach((edge) => {
        if (!doorEdges.has(edge)) return;
        const requested = source[edge] ?? fallbackDoorSize;
        normalized[edge] = normalizeDoorSize(requested);
    });

    return normalized;
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

function determineWarningLevel(diagnostics) {
    if (!diagnostics.valid) return 'critical';
    if (diagnostics.autoAdjusted) return 'warning';
    return 'none';
}

function buildNearestLengthSuggestion(length, needsDoor, diagnostics, mode, targetLength) {
    const requestedDoorSize = diagnostics.requestedDoorSize;
    const maxDelta = 5000;

    for (let delta = STEP_MM; delta <= maxDelta; delta += STEP_MM) {
        const candidates = [length - delta, length + delta];
        for (const candidateLength of candidates) {
            if (candidateLength < MIN_DIMENSION_MM) continue;

            const solved = needsDoor
                ? (requestedDoorSize ? solveEdgeWithFixedDoor(candidateLength, requestedDoorSize, mode, targetLength) : null)
                : solveExactFill(candidateLength, mode, targetLength);

            if (solved) {
                return candidateLength;
            }
        }
    }

    return null;
}

function buildEdgeWarningsAndSuggestions(edgeKey, edgeLength, needsDoor, diagnostics, mode, targetLength) {
    const warnings = [];
    const suggestions = [];
    const warningLevel = determineWarningLevel(diagnostics);

    if (!diagnostics.valid) {
        const errorText = diagnostics.errorCode === 'NO_DOOR_COMBINATION'
            ? `Ingen giltig kombination hittades för ${EDGE_LENGTH_LABEL[edgeKey]} med vald dörrstorlek.`
            : `Ingen giltig sektionskombination hittades för ${EDGE_LENGTH_LABEL[edgeKey]}.`;

        warnings.push({
            id: `warning-${edgeKey}-${diagnostics.errorCode || 'invalid'}`,
            level: 'critical',
            code: diagnostics.errorCode || 'EDGE_INVALID',
            edge: edgeKey,
            text: errorText
        });

        const nearestLength = buildNearestLengthSuggestion(edgeLength, needsDoor, diagnostics, mode, targetLength);
        const dimensionKey = EDGE_TO_DIMENSION[edgeKey];
        if (Number.isFinite(nearestLength) && nearestLength !== edgeLength) {
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

        if (needsDoor) {
            const requestedDoorSize = diagnostics.requestedDoorSize || normalizeDoorSize(1000);
            const viableDoorSize = DOOR_SIZES
                .filter((size) => size < requestedDoorSize)
                .find((size) => !!solveEdgeWithFixedDoor(edgeLength, size, mode, targetLength));

            if (Number.isFinite(viableDoorSize)) {
                suggestions.push({
                    id: `suggestion-${edgeKey}-set-door-${viableDoorSize}`,
                    type: 'setDoorSize',
                    edge: edgeKey,
                    value: viableDoorSize,
                    priority: 'high',
                    text: `Byt dörr på ${EDGE_LENGTH_LABEL[edgeKey]} till ${viableDoorSize} mm.`
                });
            }

            suggestions.push({
                id: `suggestion-${edgeKey}-remove-door`,
                type: 'toggleDoor',
                edge: edgeKey,
                value: false,
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
            id: `suggestion-${edgeKey}-confirm-door-${diagnostics.resolvedDoorSize}`,
            type: 'setDoorSize',
            edge: edgeKey,
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

function buildEdgeSummary(edgeKey, length, enabled, sections, diagnostics) {
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
        length,
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

/**
 * Compute edges, BOM counts, and totals from sketch configuration.
 */
export function computeLayout(config) {
    const includeBack = !!config.includeBack;
    const width = normalizeNumber(config.width, { fallback: 8000, min: MIN_DIMENSION_MM, max: 50000 });
    const sharedDepth = normalizeNumber(config.depth, { fallback: 4000, min: MIN_DIMENSION_MM, max: 50000 });
    const depthLeft = normalizeNumber(config.depthLeft ?? config.depth, { fallback: sharedDepth, min: MIN_DIMENSION_MM, max: 50000 });
    const depthRight = normalizeNumber(config.depthRight ?? config.depth, { fallback: sharedDepth, min: MIN_DIMENSION_MM, max: 50000 });
    const prioMode = normalizeMode(config.prioMode);
    const targetLength = normalizeNumber(config.targetLength, { fallback: 1500, min: 700, max: 2000 });
    const doorEdges = normalizeDoorEdges(config.doorEdges, includeBack);
    const fallbackDoorSize = normalizeDoorSize(config.doorSize ?? 1000);
    const doorSizeByEdge = normalizeDoorSizeByEdge(config.doorSizeByEdge, doorEdges, fallbackDoorSize);
    const manualSectionsByEdge = config.manualSectionsByEdge || {};

    const solveOptions = { prioMode, targetLength };

    function solveNamedEdge(edgeKey, length, enabled) {
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

        const needsDoor = doorEdges.has(edgeKey);
        const edgeResult = solveEdge(length, needsDoor, {
            prioMode,
            targetLength,
            doorSize: doorSizeByEdge[edgeKey] ?? fallbackDoorSize
        });

        // Apply manual section pins if any exist for this edge
        const pins = manualSectionsByEdge[edgeKey];
        let finalSections = edgeResult.sections;
        if (pins && pins.length > 0 && edgeResult.valid && !needsDoor) {
            const overridden = resolveEdgeWithPins(length, edgeResult.sections, pins, solveOptions);
            if (overridden) finalSections = overridden;
        }

        return {
            sections: finalSections,
            diagnostics: {
                valid: edgeResult.valid,
                requestedDoorSize: edgeResult.requestedDoorSize,
                resolvedDoorSize: edgeResult.resolvedDoorSize,
                autoAdjusted: edgeResult.autoAdjusted,
                errorCode: edgeResult.errorCode
            }
        };
    }

    const left = solveNamedEdge('left', depthLeft, true);
    const right = solveNamedEdge('right', depthRight, true);
    const front = solveNamedEdge('front', width, true);
    const back = solveNamedEdge('back', width, includeBack);

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
        left: buildEdgeSummary('left', depthLeft, true, leftEdge, left.diagnostics),
        right: buildEdgeSummary('right', depthRight, true, rightEdge, right.diagnostics),
        front: buildEdgeSummary('front', width, true, frontEdge, front.diagnostics),
        back: buildEdgeSummary('back', width, includeBack, backEdge, back.diagnostics)
    };

    const layoutWarnings = [];
    const suggestions = [];
    EDGE_KEYS.forEach((edgeKey) => {
        if (edgeKey === 'back' && !includeBack) return;
        const edgeLength = edgeKey === 'front' || edgeKey === 'back' ? width
            : edgeKey === 'left' ? depthLeft : depthRight;
        const needsDoor = doorEdges.has(edgeKey);
        const info = buildEdgeWarningsAndSuggestions(
            edgeKey,
            edgeLength,
            needsDoor,
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
        width,
        depth: sharedDepth,
        depthLeft,
        depthRight,
        targetLength,
        doorSizeByEdge,
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
