import type { PlanPoint, PlacedProductV1 } from './types';

export function pointInFootprint(p: PlanPoint, points: PlanPoint[]): boolean {
    let inside = false;
    for (let i = 0; i < points.length; i++) {
        const a = points[i],
            b = points[(i + 1) % points.length];
        if (a.xMm === b.xMm && a.zMm === b.zMm) continue;
        if (distanceToSegment(p, a, b) < 1e-6) return true;
        if (
            a.zMm > p.zMm !== b.zMm > p.zMm &&
            p.xMm < ((b.xMm - a.xMm) * (p.zMm - a.zMm)) / (b.zMm - a.zMm) + a.xMm
        )
            inside = !inside;
    }
    return inside;
}

export function rectanglePoints(p: PlacedProductV1): PlanPoint[] {
    if (p.footprint.kind !== 'rectangle') return [];
    const { widthMm: w, depthMm: d } = p.footprint;
    const angle = (p.rotationDeg * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
    return [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2]
    ].map(([x, z]) => ({
        xMm: p.center.xMm + x * c + z * s,
        zMm: p.center.zMm - x * s + z * c
    }));
}
export function distanceToSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint) {
    const dx = b.xMm - a.xMm,
        dz = b.zMm - a.zMm,
        squared = dx * dx + dz * dz;
    const t = squared ? Math.max(0, Math.min(1, ((p.xMm - a.xMm) * dx + (p.zMm - a.zMm) * dz) / squared)) : 0;
    return Math.hypot(p.xMm - a.xMm - t * dx, p.zMm - a.zMm - t * dz);
}
export function footprintsOverlap(a: PlacedProductV1, b: PlacedProductV1): boolean {
    if (a.footprint.kind === 'circle' && b.footprint.kind === 'circle') {
        return (
            Math.hypot(a.center.xMm - b.center.xMm, a.center.zMm - b.center.zMm) <
            (a.footprint.diameterMm + b.footprint.diameterMm) / 2 - 1e-6
        );
    }
    const pa = rectanglePoints(a),
        pb = rectanglePoints(b);
    if (!pa.length || !pb.length) return false;
    return [pa, pb].every((points) =>
        points.every((point, i) => {
            const next = points[(i + 1) % points.length],
                nx = -(next.zMm - point.zMm),
                nz = next.xMm - point.xMm;
            const va = pa.map((p) => p.xMm * nx + p.zMm * nz),
                vb = pb.map((p) => p.xMm * nx + p.zMm * nz);
            return (
                Math.min(Math.max(...va), Math.max(...vb)) - Math.max(Math.min(...va), Math.min(...vb)) > 1e-6
            );
        })
    );
}
