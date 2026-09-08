import type { PlacedProductV1 } from './types';

export interface VisualProductDimensions {
    heightMm: number;
    passageMm: number;
    spokes: number;
}
// Manufacturer's approximate open/passage dimensions, permanent in-ground installation,
// without valance. https://bahama.de/en/parasols/jumbrella/ (checked 2026-09-07).
// The published 6x6 row has passage > open height; it deliberately remains unresolved.
const jumbrella: Record<string, VisualProductDimensions> = {};
for (const [size, height, passage] of [
    [3000, 3010, 2300],
    [3500, 3110, 2260],
    [4000, 3110, 2300],
    [4500, 3110, 2300],
    [5000, 3310, 2400]
]) {
    jumbrella[`square-${size}x${size}`] = { heightMm: height, passageMm: passage, spokes: 8 };
}
for (const [w, d, height, spokes] of [
    [3000, 1500, 2950, 8],
    [3500, 3000, 3370, 10],
    [4000, 2000, 3090, 8],
    [4000, 3000, 3090, 8],
    [4000, 3500, 3370, 10],
    [4500, 3000, 3380, 8],
    [4500, 3500, 3380, 8],
    [4500, 4000, 3380, 10],
    [5000, 2500, 3230, 8],
    [5000, 3000, 3220, 10],
    [5000, 3750, 3280, 10],
    [5000, 4000, 3220, 8],
    [6000, 3000, 3370, 10],
    [6000, 4000, 3360, 10],
    [6000, 4500, 3450, 12]
]) {
    jumbrella[`rectangular-${w}x${d}`] = { heightMm: height, passageMm: 2400, spokes };
}
export const visualProductRegistry = Object.freeze({
    schemaVersion: 1,
    jumbrella: Object.freeze(jumbrella),
    fiesta: Object.freeze({ heightMm: 2260, visibleDiameterMm: 860, identityVerified: false })
});
export function getJumbrellaDimensions(p: PlacedProductV1): VisualProductDimensions | undefined {
    if (p.productType !== 'bahama.jumbrella' || p.footprint.kind !== 'rectangle') return;
    const { widthMm: w, depthMm: d } = p.footprint;
    if (p.variantKey !== `${w === d ? 'square' : 'rectangular'}-${w}x${d}`) return;
    return jumbrella[p.variantKey];
}
