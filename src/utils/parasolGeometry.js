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

            const p1Left = p1.xMm - p1.widthMm / 2;
            const p1Right = p1.xMm + p1.widthMm / 2;
            const p1Top = p1.yMm + p1.depthMm / 2;
            const p1Bottom = p1.yMm - p1.depthMm / 2;

            const p2Left = p2.xMm - p2.widthMm / 2;
            const p2Right = p2.xMm + p2.widthMm / 2;
            const p2Top = p2.yMm + p2.depthMm / 2;
            const p2Bottom = p2.yMm - p2.depthMm / 2;

            // Check AABB overlap
            if (p1Left < p2Right && p1Right > p2Left &&
                p1Bottom < p2Top && p1Top > p2Bottom) {
                return [{ id: 'parasol-overlap', text: 'Flera parasoller overlappar varandra.' }];
            }
        }
    }

    return [];
}

/**
 * Core configuration for available parasol presets
 */
export const PARASOL_PRESETS = [
    {
        id: 'parasol_3x3',
        label: '3x3 Kvadrat',
        widthMm: 3000,
        depthMm: 3000,
        exportLine: 'BaHaMa',
        exportModel: 'Jumbrella',
        exportSize: '3x3 Kvadrat'
    },
    {
        id: 'parasol_4x4',
        label: '4x4 Kvadrat',
        widthMm: 4000,
        depthMm: 4000,
        exportLine: 'BaHaMa',
        exportModel: 'Jumbrella',
        exportSize: '4x4 Kvadrat'
    },
    {
        id: 'parasol_5x5',
        label: '5x5 Kvadrat',
        widthMm: 5000,
        depthMm: 5000,
        exportLine: 'BaHaMa',
        exportModel: 'Jumbrella',
        exportSize: '5x5 Kvadrat'
    },
    {
        id: 'parasol_4x3',
        label: '4x3 Rektangel',
        widthMm: 4000,
        depthMm: 3000,
        exportLine: 'BaHaMa',
        exportModel: 'Jumbrella',
        exportSize: '4x3 Rektangel'
    }
];

export function snapToStep100(value) {
    return Math.round(value / 100) * 100;
}
