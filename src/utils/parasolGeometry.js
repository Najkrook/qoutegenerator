import { catalogData } from '../data/catalog';

/**
 * @typedef {Object} Polygon
 * @property {Array<{x: number, y: number}>} points
 */

/**
 * Creates a polygon representing the drawn area based on the current Sketch config.
 * Handles equal depth (rectangle) and split depth (trapezoid).
 * @param {Object} config The valid Sketch configuration
 * @returns {Polygon}
 */
export function getAreaPolygon(config) {
    const w = Number(config?.width) || 0;
    const dl = Number(config?.depthLeft ?? config?.depth) || 0;
    const dr = Number(config?.depthRight ?? config?.depth) || 0;
    const maxDepth = Math.max(dl, dr);

    // Must match SketchCanvas world coordinates:
    // y=0 at back/wall, increasing downward toward front edge.
    return {
        points: [
            { x: 0, y: maxDepth },
            { x: w, y: maxDepth },
            { x: w, y: maxDepth - dr },
            { x: 0, y: maxDepth - dl }
        ]
    };
}

/**
 * Checks if a given point is inside or on the boundary of a polygon.
 * Uses ray-casting algorithm.
 * @param {number} x X coordinate in mm
 * @param {number} y Y coordinate in mm
 * @param {Polygon} polygon The area polygon
 * @returns {boolean}
 */
export function pointInPolygon(x, y, polygon) {
    if (!polygon?.points || polygon.points.length < 3) return false;

    const isPointOnSegment = (px, py, ax, ay, bx, by) => {
        const eps = 1e-6;
        const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
        if (Math.abs(cross) > eps) return false;
        const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
        if (dot < -eps) return false;
        const squaredLen = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
        return dot <= squaredLen + eps;
    };

    const pts = polygon.points;

    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if (isPointOnSegment(x, y, pts[j].x, pts[j].y, pts[i].x, pts[i].y)) {
            return true;
        }
    }

    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x;
        const yi = pts[i].y;
        const xj = pts[j].x;
        const yj = pts[j].y;

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

export function getParasolRotationDeg(parasol) {
    return parasol?.rotationDeg === 90 ? 90 : 0;
}

export function isParasolRotatable(parasol) {
    if (!parasol) return false;
    return Number(parasol.widthMm) > 0
        && Number(parasol.depthMm) > 0
        && Number(parasol.widthMm) !== Number(parasol.depthMm);
}

export function getEffectiveParasolDimensions(parasol) {
    const widthMm = Number(parasol?.widthMm) || 0;
    const depthMm = Number(parasol?.depthMm) || 0;
    const rotationDeg = getParasolRotationDeg(parasol);

    if (rotationDeg === 90) {
        return {
            widthMm: depthMm,
            depthMm: widthMm
        };
    }

    return { widthMm, depthMm };
}

/**
 * Warns if parasols AABB overlap.
 * @param {Array<Object>} parasols Array of placed parasol objects
 * @returns {Array<{id: string, text: string}>} Array of warning messages
 */
export function computeParasolOverlapWarnings(parasols) {
    for (let i = 0; i < parasols.length; i++) {
        for (let j = i + 1; j < parasols.length; j++) {
            const p1 = parasols[i];
            const p2 = parasols[j];
            const p1Dims = getEffectiveParasolDimensions(p1);
            const p2Dims = getEffectiveParasolDimensions(p2);

            const p1Left = p1.xMm - p1Dims.widthMm / 2;
            const p1Right = p1.xMm + p1Dims.widthMm / 2;
            const p1Top = p1.yMm + p1Dims.depthMm / 2;
            const p1Bottom = p1.yMm - p1Dims.depthMm / 2;

            const p2Left = p2.xMm - p2Dims.widthMm / 2;
            const p2Right = p2.xMm + p2Dims.widthMm / 2;
            const p2Top = p2.yMm + p2Dims.depthMm / 2;
            const p2Bottom = p2.yMm - p2Dims.depthMm / 2;

            // Check AABB overlap
            if (p1Left < p2Right && p1Right > p2Left &&
                p1Bottom < p2Top && p1Top > p2Bottom) {
                return [{ id: 'parasol-overlap', text: 'Flera parasoller overlappar varandra.' }];
            }
        }
    }

    return [];
}

export const DEFAULT_PARASOL_PRESET_ID = 'parasol_3x3';

const LEGACY_PRESET_IDS = {
    '3x3 Kvadrat': 'parasol_3x3',
    '4x4 Kvadrat': 'parasol_4x4',
    '5x5 Kvadrat': 'parasol_5x5',
    '4x3 Rektangel': 'parasol_4x3'
};

const CATEGORY_ORDER = ['Kvadrat', 'Rektangel', 'Övrigt'];

function slugifyPresetLabel(label) {
    return label
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s,.*-]/g, '')
        .replace(/\*/g, 'runda')
        .replace(/,/g, '')
        .replace(/\s+/g, '_')
        .replace(/x/g, 'x');
}

export function parseMetricToken(token) {
    const normalized = String(token || '').trim().replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed * 1000);
}

export function parseJumbrellaSize(sizeLabel) {
    const label = String(sizeLabel || '').trim();
    if (!label) return null;

    const roundMatch = label.match(/^([\d,]+)\*\s+Runda$/i);
    if (roundMatch) {
        const diameterMm = parseMetricToken(roundMatch[1]);
        if (!diameterMm) return null;
        return {
            widthMm: diameterMm,
            depthMm: diameterMm,
            shapeCategory: 'Runda'
        };
    }

    const rectMatch = label.match(/^([\d,]+)x([\d,]+)\s+(Kvadrat|Rektangel)$/i);
    if (!rectMatch) return null;

    const widthMm = parseMetricToken(rectMatch[1]);
    const depthMm = parseMetricToken(rectMatch[2]);
    if (!widthMm || !depthMm) return null;

    return {
        widthMm,
        depthMm,
        shapeCategory: rectMatch[3][0].toUpperCase() + rectMatch[3].slice(1).toLowerCase()
    };
}

function buildPresetId(label) {
    return LEGACY_PRESET_IDS[label] || `jumbrella_${slugifyPresetLabel(label)}`;
}

export function buildJumbrellaParasolPresets() {
    const jumbrellaSizes = catalogData?.BaHaMa?.models?.Jumbrella?.sizes || {};

    return Object.keys(jumbrellaSizes).reduce((presets, sizeLabel) => {
        const parsed = parseJumbrellaSize(sizeLabel);

        if (!parsed) {
            console.warn(`[parasolGeometry] Could not parse Jumbrella size "${sizeLabel}" for sketch presets.`);
            return presets;
        }

        if (parsed.shapeCategory === 'Runda') {
            return presets;
        }

        presets.push({
            id: buildPresetId(sizeLabel),
            label: sizeLabel,
            widthMm: parsed.widthMm,
            depthMm: parsed.depthMm,
            shapeCategory: parsed.shapeCategory,
            exportLine: 'BaHaMa',
            exportModel: 'Jumbrella',
            exportSize: sizeLabel
        });

        return presets;
    }, []);
}

export function groupParasolPresetsByCategory(presets) {
    const grouped = presets.reduce((acc, preset) => {
        const category = CATEGORY_ORDER.includes(preset.shapeCategory) ? preset.shapeCategory : 'Övrigt';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(preset);
        return acc;
    }, {});

    return CATEGORY_ORDER
        .filter((category) => (grouped[category] || []).length > 0)
        .map((category) => ({
            category,
            presets: grouped[category]
        }));
}

/**
 * Core configuration for available parasol presets
 */
export const PARASOL_PRESETS = buildJumbrellaParasolPresets();

export function getParasolPresetById(presetId) {
    return PARASOL_PRESETS.find((preset) => preset.id === presetId) || null;
}

export function snapToStep100(value) {
    return Math.round(value / 100) * 100;
}
