import type { SketchConfigState } from '../../types/contracts';
import { computeLayout } from '../../utils/sectionCalculator';
import { getAreaPolygon, getParasolPresetById } from '../../utils/parasolGeometry';
import { distanceToSegment, footprintsOverlap, pointInFootprint } from './footprints';
import { combineProblems } from './visualizationProblems';
import { validateVisualizationPlan } from './validateVisualizationPlan';
import {
    VISUALIZATION_COORDINATES,
    type VisualizationPlanV1,
    type VisualizationProblemV1,
    type ClickitUpRunV1,
    type PlacedProductV1,
    type RunId
} from './types';

/** No writes, normalization or commercial data crosses this boundary. Input is the hydrated sketch. */
export function buildVisualizationPlan(config: SketchConfigState): VisualizationPlanV1 {
    if (
        !config ||
        ![config.width, config.depthLeft, config.depthRight].every(
            (n) => Number.isSafeInteger(n) && n >= 0
        ) ||
        config.width < 1000 ||
        !Array.isArray(config.parasols) ||
        !Array.isArray(config.fiestaItems)
    )
        throw new Error('PLAN_INVALID');
    const layout = computeLayout(config);
    if (
        layout.width !== config.width ||
        layout.depthLeft !== config.depthLeft ||
        layout.depthRight !== config.depthRight
    )
        throw new Error('PLAN_INVALID');
    const maxDepth = Math.max(layout.depthLeft, layout.depthRight);
    const polygon = getAreaPolygon(config);
    const plan: VisualizationPlanV1 = {
        schemaVersion: 1,
        units: 'mm',
        coordinateSystem: { ...VISUALIZATION_COORDINATES },
        footprint: { points: polygon.points.map((p) => ({ xMm: p.x, zMm: maxDepth - p.y })) },
        clickitUpRuns: [],
        placedProducts: [],
        problems: []
    };
    const issue = (
        code: string,
        entityRef: VisualizationProblemV1['entityRef'],
        effect: VisualizationProblemV1['effect'] = 'degraded',
        severity: VisualizationProblemV1['severity'] = 'warning'
    ) => {
        plan.problems.push({ code, entityRef, effect, severity });
    };
    for (const id of ['front', 'left', 'right', 'back'] as RunId[]) {
        const edge = layout.edgeSummaries[id];
        if (!edge.enabled) continue;
        const side = id === 'left' || id === 'right';
        const start = side
            ? {
                  xMm: id === 'left' ? 0 : layout.width,
                  zMm: id === 'left' ? layout.depthLeft : layout.depthRight
              }
            : { xMm: 0, zMm: id === 'front' ? 0 : maxDepth };
        const end = side
            ? { xMm: start.xMm, zMm: start.zMm - edge.effectiveLength }
            : { xMm: layout.width, zMm: start.zMm };
        const run: ClickitUpRunV1 = {
            id,
            start,
            end,
            members: edge.valid
                ? edge.segments.map((s) => ({ index: s.index, kind: s.type, lengthMm: s.length }))
                : [],
            trailingPostMm: edge.leadingPostMm,
            terminals: { start: { kind: 'free' }, end: { kind: 'free' } }
        };
        plan.clickitUpRuns.push(run);
        if (!edge.valid)
            issue(
                { NO_DOOR_COMBINATION: 'RUN_NO_DOOR_COMBINATION', WRONG_COUNT: 'RUN_WRONG_MEMBER_COUNT' }[
                    edge.errorCode
                ] || 'RUN_NO_SECTION_SOLUTION',
                { kind: 'run', id },
                'omitted',
                'error'
            );
        if (edge.autoAdjusted) issue('DOOR_AUTO_ADJUSTED', { kind: 'run', id });
    }
    const connect = (a: RunId, at: 'start' | 'end', b: RunId, bt: 'start' | 'end', expectedGap = 0) => {
        const ra = plan.clickitUpRuns.find((r) => r.id === a),
            rb = plan.clickitUpRuns.find((r) => r.id === b);
        if (!ra || !rb) return;
        const gap = Math.hypot(ra[at].xMm - rb[bt].xMm, ra[at].zMm - rb[bt].zMm);
        if (Math.abs(gap - expectedGap) > 1e-6) {
            for (const [r, t] of [
                [ra, at],
                [rb, bt]
            ] as const) {
                r.terminals[t] = { kind: 'unresolved' };
                issue('RUN_ENDPOINT_DISCONNECTED', { kind: 'run', id: r.id }, 'omitted', 'error');
            }
        } else {
            ra.terminals[at] = {
                kind: 'corner',
                connectsTo: { runId: b, terminal: bt },
                connectionGapMm: gap
            };
            rb.terminals[bt] = {
                kind: 'corner',
                connectsTo: { runId: a, terminal: at },
                connectionGapMm: gap
            };
        }
    };
    connect('front', 'start', 'left', 'end', layout.edgeSummaries.left.setbackMm);
    connect('front', 'end', 'right', 'end', layout.edgeSummaries.right.setbackMm);
    connect('back', 'start', 'left', 'start');
    connect('back', 'end', 'right', 'start');
    // Reserve every source identity before generating IDs so a later valid ID cannot collide.
    const sources = [
        ...config.parasols.map((p) => ({ p, fiesta: false })),
        ...config.fiestaItems.map((p) => ({ p, fiesta: true }))
    ];
    const reserved = new Set(
        sources.map(({ p }) => p?.id).filter((id) => typeof id === 'string' && !!id.trim())
    );
    const seen = new Set<string>();
    sources.forEach(({ p, fiesta }, index) => {
        let id = p?.id;
        const repaired = typeof id !== 'string' || !id.trim() || seen.has(id);
        if (repaired) {
            id = `visualization-${index}`;
            while (reserved.has(id) || seen.has(id)) id += '-';
        }
        seen.add(id);
        const ref = { kind: 'placed-product' as const, id };
        if (repaired) issue('PRODUCT_INSTANCE_ID_REPAIRED', ref);
        if (!p || typeof p !== 'object') {
            issue('PRODUCT_DIMENSIONS_INVALID', ref, 'omitted', 'error');
            return;
        }
        const width = fiesta ? ('diameterMm' in p ? p.diameterMm : NaN) : 'widthMm' in p ? p.widthMm : NaN;
        const depth = fiesta ? width : 'depthMm' in p ? p.depthMm : NaN;
        const rotation = 'rotationDeg' in p ? p.rotationDeg : 0;
        if (
            ![width, depth].every((n) => Number.isSafeInteger(n) && n > 0) ||
            ![p.xMm, p.yMm].every(Number.isSafeInteger) ||
            !Number.isFinite(rotation)
        ) {
            issue('PRODUCT_DIMENSIONS_INVALID', ref, 'omitted', 'error');
            if ([p.xMm, p.yMm].every(Number.isSafeInteger)) {
                plan.problems.at(-1)!.location = { xMm: p.xMm, zMm: maxDepth - p.yMm };
            }
            return;
        }
        const preset = 'presetId' in p ? getParasolPresetById(p.presetId) : null;
        const known =
            !fiesta &&
            p.exportLine === 'BaHaMa' &&
            p.exportModel === 'Jumbrella' &&
            preset?.widthMm === width &&
            preset?.depthMm === depth;
        const product: PlacedProductV1 = {
            instanceId: id,
            productType: fiesta ? 'fiesta.f1-f' : known ? 'bahama.jumbrella' : 'unknown.parasol',
            variantKey: fiesta
                ? 'standard'
                : known
                  ? `${width === depth ? 'square' : 'rectangular'}-${width}x${depth}`
                  : undefined,
            center: { xMm: p.xMm, zMm: maxDepth - p.yMm },
            rotationDeg: rotation,
            footprint: fiesta
                ? { kind: 'circle', diameterMm: width }
                : { kind: 'rectangle', widthMm: width, depthMm: depth }
        };
        plan.placedProducts.push(product);
        if (!known && !fiesta) issue('PRODUCT_KEY_UNKNOWN', ref);
        const inside = pointInFootprint(product.center, plan.footprint.points);
        if (!inside) issue('PRODUCT_CENTER_OUTSIDE', ref, 'degraded', 'error');
        else if (
            fiesta &&
            plan.footprint.points.some(
                (a, i) =>
                    distanceToSegment(product.center, a, plan.footprint.points[(i + 1) % 4]) <
                    width / 2 - 1e-6
            )
        )
            issue('FIESTA_FOOTPRINT_OUTSIDE', ref);
    });
    for (let i = 0; i < plan.placedProducts.length; i++)
        for (let j = i + 1; j < plan.placedProducts.length; j++) {
            const a = plan.placedProducts[i],
                b = plan.placedProducts[j];
            if ((a.productType === 'fiesta.f1-f') !== (b.productType === 'fiesta.f1-f')) continue;
            if (footprintsOverlap(a, b))
                for (const p of [a, b])
                    issue('PRODUCT_OVERLAP', { kind: 'placed-product', id: p.instanceId });
        }
    plan.problems = combineProblems(plan.problems);
    return validateVisualizationPlan(plan);
}
