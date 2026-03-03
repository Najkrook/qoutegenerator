/**
 * Section calculator for ClickitUP outdoor seating layouts.
 * Pure logic — no UI dependencies.
 */

export const STANDARD_SIZES = [2000, 1900, 1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100, 1000];
export const MIN_SECTION_SIZE = 1000;

/**
 * Calculates the best combination of glass sections to fill a given length.
 * @param {number} totalLength - Total edge length in mm
 * @param {boolean} needsDoor - Whether a door should be placed on this edge
 * @param {object} options - { prioMode, targetLength, doorSize }
 * @returns {Array} Array of section lengths (numbers) and door markers (strings like "Dörr 1000")
 */
export function calculateSectionsForEdge(totalLength, needsDoor = false, options = {}) {
    const { prioMode = 'symmetrical', targetLength = 1500, doorSize = 1000 } = options;

    if (totalLength <= 0) return [];

    let remaining = totalLength;
    let sections = [];

    if (needsDoor) {
        if (remaining >= doorSize) {
            sections.push(`Dörr ${doorSize}`);
            remaining -= doorSize;
        } else {
            return [];
        }
    }

    if (remaining === 0) return sections;

    if (prioMode === 'convenient') {
        return [...sections, ...calcConvenient(remaining)];
    } else if (prioMode === 'symmetrical') {
        return [...sections, ...calcSymmetrical(remaining)];
    } else {
        return [...sections, ...calcTarget(remaining, targetLength)];
    }
}

function calcConvenient(remaining) {
    const sections = [];
    const sizesDesc = [...STANDARD_SIZES].sort((a, b) => b - a);

    while (remaining > 0) {
        if (remaining <= 2000 && remaining >= MIN_SECTION_SIZE && STANDARD_SIZES.includes(remaining)) {
            sections.push(remaining);
            remaining = 0;
            break;
        }

        let placed = false;
        for (const sz of sizesDesc) {
            if (sz <= remaining) {
                const leftover = remaining - sz;
                if (leftover === 0 || leftover >= MIN_SECTION_SIZE) {
                    sections.push(sz);
                    remaining = leftover;
                    placed = true;
                    break;
                }
            }
        }

        if (!placed) {
            let half = Math.round(remaining / 2 / 100) * 100;
            if (half < MIN_SECTION_SIZE) half = MIN_SECTION_SIZE;
            if (half > 2000) half = 2000;
            sections.push(half);
            remaining -= half;
            if (remaining > 0 && remaining < MIN_SECTION_SIZE) {
                sections[sections.length - 1] += remaining;
                remaining = 0;
            }
        }
    }
    return sections;
}

function calcSymmetrical(remaining) {
    const sections = [];
    let bestSize = 1500;
    let bestDiff = Infinity;
    let bestCount = 1;

    for (const sz of STANDARD_SIZES) {
        const count = Math.floor(remaining / sz);
        if (count < 1) continue;
        const total = count * sz;
        if (total > remaining) continue;
        const diff = remaining - total;
        if (diff < bestDiff) {
            bestDiff = diff;
            bestSize = sz;
            bestCount = count;
        }
    }

    for (let i = 0; i < bestCount; i++) {
        sections.push(bestSize);
    }
    const leftover = remaining - (bestCount * bestSize);

    if (leftover > 0) {
        if (leftover >= MIN_SECTION_SIZE) {
            sections.push(leftover);
        } else if (sections.length > 0) {
            sections.pop();
            const combined = bestSize + leftover;
            const half1 = Math.ceil(combined / 2 / 100) * 100;
            const half2 = combined - half1;
            if (half1 >= MIN_SECTION_SIZE) sections.push(half1);
            if (half2 >= MIN_SECTION_SIZE) sections.push(half2);
            if (half1 < MIN_SECTION_SIZE && half2 < MIN_SECTION_SIZE) {
                sections.push(combined);
            }
        } else {
            sections.push(remaining);
        }
    }
    return sections;
}

function calcTarget(remaining, targetLength) {
    const sections = [];

    while (remaining >= targetLength * 2) {
        sections.push(targetLength);
        remaining -= targetLength;
    }

    if (remaining === 0) return sections;

    if (STANDARD_SIZES.includes(remaining)) {
        sections.push(remaining);
        return sections;
    }

    if (remaining > 2000) {
        let half1 = Math.floor(remaining / 2 / 100) * 100;
        let half2 = remaining - half1;
        if (half1 >= MIN_SECTION_SIZE && half1 <= 2000) sections.push(half1);
        else sections.push(remaining / 2);
        if (half2 >= MIN_SECTION_SIZE && half2 <= 2000) sections.push(half2);
        else sections.push(remaining / 2);
        return sections;
    }

    sections.push(remaining);
    return sections;
}

/**
 * Compute edges, BOM counts, and totals from sketch configuration.
 */
export function computeLayout(config) {
    const { width, depth, includeBack, doorEdges, prioMode, targetLength, doorSize } = config;
    const opts = { prioMode, targetLength, doorSize };

    const leftEdge = calculateSectionsForEdge(depth, doorEdges.has('left'), opts);
    const rightEdge = calculateSectionsForEdge(depth, doorEdges.has('right'), opts);
    const frontEdge = calculateSectionsForEdge(width, doorEdges.has('front'), opts);
    const backEdge = includeBack ? calculateSectionsForEdge(width, doorEdges.has('back'), opts) : [];

    const allSections = [...leftEdge, ...rightEdge, ...frontEdge, ...backEdge];
    const doorCount = allSections.filter(s => String(s).includes('Dörr')).length;
    const slimlineCount = doorCount;
    const stodbenCount = includeBack ? 0 : 2;

    // BOM counts
    const counts = {};
    let totalGlassLength = 0;
    allSections.forEach(s => {
        counts[s] = (counts[s] || 0) + 1;
        if (typeof s === 'number') totalGlassLength += s;
    });

    return {
        leftEdge, rightEdge, frontEdge, backEdge,
        allSections, doorCount, slimlineCount, stodbenCount,
        counts, totalGlassLength
    };
}
