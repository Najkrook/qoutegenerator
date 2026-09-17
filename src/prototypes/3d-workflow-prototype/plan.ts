// THROWAWAY workflow adapter. Commercial state never crosses this boundary.
import { computeLayout } from '../../utils/sectionCalculator';
import { getAreaPolygon, getEffectiveParasolDimensions, getParasolPresetById, pointInPolygon } from '../../utils/parasolGeometry';
import type { SketchConfigState } from '../../types/contracts';

export function buildWorkflowPlan(config: SketchConfigState) {
    const layout = computeLayout(config);
    const maxDepth = Math.max(layout.depthLeft, layout.depthRight);
    const polygon = getAreaPolygon(config);
    const problems: Array<{ id: string; text: string; effect: 'degraded' | 'omitted' }> = [];
    const issue = (id: string, text: string, effect: 'degraded' | 'omitted' = 'degraded') => problems.push({ id, text, effect });
    const starts = {
        front: [0, 0], left: [0, layout.depthLeft],
        right: [layout.width, layout.depthRight], back: [0, maxDepth]
    };
    const runs = Object.values(layout.edgeSummaries).filter(edge => edge.enabled).map(edge => {
        if (!edge.valid) issue(edge.edge, `${edge.edge}: en giltig sektionskombination saknas.`, 'omitted');
        if (edge.autoAdjusted) issue(edge.edge, `${edge.edge}: dörrstorleken har autojusterats.`);
        return {
            id: edge.edge, startMm: starts[edge.edge],
            direction: edge.edge === 'left' || edge.edge === 'right' ? [0, -1] : [1, 0],
            leadingPostMm: edge.leadingPostMm, lengthMm: edge.effectiveLength,
            members: edge.segments.map(member => ({ kind: member.type, lengthMm: member.length }))
        };
    });
    if (config.includeBack && layout.depthLeft !== layout.depthRight) {
        issue('back', 'Bakkanten ansluter inte till båda sidornas ändpunkter.', 'omitted');
    }
    if (runs.length) issue('front', 'ClickitUp visas med prototypens förenklade sektions- och dörrmodeller.');
    const ids = new Set<string>();
    const products = [...config.parasols.map(p => ({ ...p, type: 'parasol' as const })),
        ...config.fiestaItems.map(p => ({ ...p, type: 'fiesta' as const }))].flatMap((p, index) => {
        const id = p.id && !ids.has(p.id) ? p.id : `prototype-instance-${index}`;
        ids.add(id);
        if (id !== p.id) issue(id, 'En produkt saknade unik identitet i skissen.');
        const width = p.type === 'fiesta' ? p.diameterMm : p.widthMm;
        const depth = p.type === 'fiesta' ? p.diameterMm : p.depthMm;
        if (![width, depth].every(n => Number.isFinite(n) && n > 0) || ![p.xMm, p.yMm].every(Number.isFinite)) {
            issue(id, 'Produkten saknar användbara mått eller position.', 'omitted');
            return [];
        }
        const preset = p.type === 'parasol' ? getParasolPresetById(p.presetId) : null;
        // This workflow proxy only represents rectangular canopies; other shapes remain explicit footprints.
        const knownRectangle = preset && /kvadrat|rektangel/i.test(preset.shapeCategory);
        const type = p.type === 'fiesta' ? 'fiesta' : knownRectangle ? 'jumbrella' : 'unknown';
        if (type !== 'jumbrella') issue(id, type === 'fiesta'
            ? 'Fiesta visas förenklat. Produktidentiteten behöver verifieras.'
            : 'Denna parasollvariant visas som en förenklad footprint med skissens mått.');
        if (!pointInPolygon(p.xMm, p.yMm, polygon)) issue(id, 'Produktens centrum ligger utanför skissytan.');
        if (p.type === 'fiesta') {
            const radius = width / 2;
            const outside = polygon.points.some((a, i) => {
                const b = polygon.points[(i + 1) % polygon.points.length];
                const dx = b.x - a.x, dy = b.y - a.y;
                const lengthSquared = dx * dx + dy * dy;
                if (!lengthSquared) return false;
                const t = Math.max(0, Math.min(1, ((p.xMm - a.x) * dx + (p.yMm - a.y) * dy) / lengthSquared));
                return Math.hypot(p.xMm - a.x - t * dx, p.yMm - a.y - t * dy) < radius;
            });
            if (outside) issue(id, 'Fiesta ligger delvis utanför skissytan.');
        }
        return [{ id, type, centerMm: [p.xMm, maxDepth - p.yMm], widthMm: width, depthMm: depth,
            rotationDeg: p.type === 'parasol' ? p.rotationDeg : 0 }];
    });
    for (let i = 0; i < products.length; i++) for (let j = i + 1; j < products.length; j++) {
        const a = products[i], b = products[j];
        if ((a.type === 'fiesta') !== (b.type === 'fiesta')) continue;
        const da = getEffectiveParasolDimensions(a), db = getEffectiveParasolDimensions(b);
        const overlaps = a.type === 'fiesta'
            ? Math.hypot(a.centerMm[0] - b.centerMm[0], a.centerMm[1] - b.centerMm[1]) < (a.widthMm + b.widthMm) / 2
            : Math.abs(a.centerMm[0] - b.centerMm[0]) < (da.widthMm + db.widthMm) / 2
                && Math.abs(a.centerMm[1] - b.centerMm[1]) < (da.depthMm + db.depthMm) / 2;
        if (overlaps) for (const product of [a, b]) issue(product.id, 'Två produkter av samma typ överlappar.');
    }
    return { schemaVersion: 1 as const, units: 'mm' as const,
        footprint: polygon.points.map(p => [p.x, maxDepth - p.y]), runs, products, problems };
}

export type WorkflowPlan = ReturnType<typeof buildWorkflowPlan>;
