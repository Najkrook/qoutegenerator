import { VISUALIZATION_COORDINATES, type VisualizationPlanV1 } from './types';

/** Validation never repairs input. A bad root contract is terminal, not a plausible-looking scene. */
export function validateVisualizationPlan(value: unknown): VisualizationPlanV1 {
    const p = value as VisualizationPlanV1;
    if (p?.schemaVersion !== 1) throw new Error('PLAN_SCHEMA_UNSUPPORTED');
    const fail = () => {
        throw new Error('PLAN_INVALID');
    };
    const mm = (n: unknown) => Number.isSafeInteger(n);
    const point = (v: any) => v && mm(v.xMm) && mm(v.zMm);
    if (
        p.units !== 'mm' ||
        !p.coordinateSystem ||
        Object.entries(VISUALIZATION_COORDINATES).some(([k, v]) => p.coordinateSystem[k] !== v) ||
        !Array.isArray(p.footprint?.points) ||
        p.footprint.points.length !== 4 ||
        !p.footprint.points.every(point) ||
        !Array.isArray(p.clickitUpRuns) ||
        !Array.isArray(p.placedProducts) ||
        !Array.isArray(p.problems)
    )
        fail();
    const [fl, fr, br, bl] = p.footprint.points;
    if (
        fl.xMm !== 0 ||
        fl.zMm !== 0 ||
        fr.xMm <= 0 ||
        fr.zMm !== 0 ||
        br.xMm !== fr.xMm ||
        bl.xMm !== 0 ||
        br.zMm < 0 ||
        bl.zMm < 0
    )
        fail();
    const ids = new Set<string>();
    for (const r of p.clickitUpRuns) {
        if (
            !r ||
            !['front', 'left', 'right', 'back'].includes(r.id) ||
            ids.has(r.id) ||
            !point(r.start) ||
            !point(r.end) ||
            !Array.isArray(r.members) ||
            !r.terminals
        )
            fail();
        ids.add(r.id);
        if (r.trailingPostMm !== undefined && (!mm(r.trailingPostMm) || r.trailingPostMm < 0)) fail();
        if (
            r.members.some(
                (m, i) =>
                    !m ||
                    m.index !== i ||
                    !['section', 'door'].includes(m.kind) ||
                    !mm(m.lengthMm) ||
                    m.lengthMm <= 0
            )
        )
            fail();
        const length = Math.hypot(r.end.xMm - r.start.xMm, r.end.zMm - r.start.zMm);
        if (
            length <= 0 ||
            (r.members.length &&
                Math.abs(r.members.reduce((n, m) => n + m.lengthMm, 0) + (r.trailingPostMm || 0) - length) >
                    1e-6)
        )
            fail();
        if (
            !r.members.length &&
            !p.problems.some((problem) => problem?.effect === 'omitted' && problem.entityRef?.id === r.id)
        )
            fail();
        for (const name of ['start', 'end'] as const) {
            const t = r.terminals[name];
            if (!t || !['corner', 'free', 'unresolved'].includes(t.kind)) fail();
            if (t.kind === 'corner') {
                const neighbor = p.clickitUpRuns.find((run) => run.id === t.connectsTo?.runId);
                const terminal = t.connectsTo?.terminal;
                if (!neighbor || neighbor === r || !['start', 'end'].includes(terminal)) fail();
                if (t.connectionGapMm !== undefined && (!mm(t.connectionGapMm) || t.connectionGapMm < 0))
                    fail();
                const reverse = neighbor.terminals?.[terminal];
                if (
                    reverse?.kind !== 'corner' ||
                    reverse.connectsTo?.runId !== r.id ||
                    reverse.connectsTo?.terminal !== name
                )
                    fail();
                if (
                    Math.abs(
                        Math.hypot(
                            r[name].xMm - neighbor[terminal].xMm,
                            r[name].zMm - neighbor[terminal].zMm
                        ) - (t.connectionGapMm || 0)
                    ) > 1e-6
                )
                    fail();
            }
        }
    }
    ids.clear();
    for (const product of p.placedProducts) {
        if (
            !product ||
            typeof product.instanceId !== 'string' ||
            !product.instanceId ||
            ids.has(product.instanceId) ||
            !point(product.center) ||
            !Number.isFinite(product.rotationDeg) ||
            typeof product.productType !== 'string' ||
            !product.productType
        )
            fail();
        ids.add(product.instanceId);
        const f = product.footprint;
        if (!f || !['rectangle', 'circle'].includes(f.kind)) fail();
        const dims = f.kind === 'circle' ? [f.diameterMm] : [f.widthMm, f.depthMm];
        if (!dims.every((n) => mm(n) && n > 0)) fail();
    }
    for (const problem of p.problems) {
        if (
            !problem ||
            typeof problem.code !== 'string' ||
            !problem.code ||
            !['warning', 'error'].includes(problem.severity) ||
            !['omitted', 'degraded'].includes(problem.effect) ||
            !['plan', 'run', 'run-member', 'placed-product'].includes(problem.entityRef?.kind) ||
            typeof problem.entityRef.id !== 'string' ||
            (problem.location !== undefined && !point(problem.location))
        )
            fail();
    }
    return p;
}
