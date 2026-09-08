import { describe, expect, it } from 'vitest';
import { buildVisualizationPlan } from '../src/features/visualization/buildVisualizationPlan';
import { validateVisualizationPlan } from '../src/features/visualization/validateVisualizationPlan';
import {
    footprintsOverlap,
    pointInFootprint,
    rectanglePoints
} from '../src/features/visualization/footprints';
import { getVisualizationExportPolicy } from '../src/features/visualization/visualizationProblems';
import { getJumbrellaDimensions } from '../src/features/visualization/visualProductRegistry';
import { hydrateQuoteState } from '../src/store/quoteStateSchema';

import { sketch, parasol } from './helpers/visualizationFixtures';
const codes = (plan) => plan.problems.map((p) => p.code);
function freeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

describe('VisualizationPlanV1 adapter', () => {
    it('omits a malformed product without losing its valid neighbors and retains usable error anchors', () => {
        const plan = buildVisualizationPlan(
            sketch({ parasols: [null, parasol({ id: 'invalid', widthMm: 0 }), parasol({ id: 'valid' })] })
        );
        expect(plan.placedProducts.map((p) => p.instanceId)).toEqual(['valid']);
        expect(
            plan.problems.find((p) => p.entityRef.id === 'invalid' && p.effect === 'omitted').location
        ).toEqual({ xMm: 2000, zMm: 3000 });
        expect(plan.problems.filter((p) => p.code === 'PRODUCT_DIMENSIONS_INVALID')).toHaveLength(2);
    });
    it('preserves immutable source, mm, side member order, trailing allowance and explicit corner gap', () => {
        const input = freeze(sketch());
        const first = buildVisualizationPlan(input);
        expect(buildVisualizationPlan(input)).toEqual(first);
        const side = first.clickitUpRuns.find((r) => r.id === 'left');
        expect(side.start).toEqual({ xMm: 0, zMm: 6000 });
        expect(side.end).toEqual({ xMm: 0, zMm: 20 });
        expect(side.trailingPostMm).toBe(80);
        expect(side.members.reduce((n, m) => n + m.lengthMm, 0)).toBe(5900);
        expect(side.terminals.end).toEqual({
            kind: 'corner',
            connectsTo: { runId: 'front', terminal: 'start' },
            connectionGapMm: 20
        });
        expect(first.footprint.points).toEqual([
            { xMm: 0, zMm: 0 },
            { xMm: 8000, zMm: 0 },
            { xMm: 8000, zMm: 6000 },
            { xMm: 0, zMm: 6000 }
        ]);
        expect(first).not.toHaveProperty('prices');
        expect(first).not.toHaveProperty('camera');
    });
    it('preserves diagonal footprint and disconnected horizontal back without repairing either', () => {
        const plan = buildVisualizationPlan(
            sketch({ equalDepth: false, depthLeft: 5000, depthRight: 6000, includeBack: true })
        );
        expect(plan.footprint.points[3]).toEqual({ xMm: 0, zMm: 5000 });
        expect(plan.clickitUpRuns.find((r) => r.id === 'back').start).toEqual({ xMm: 0, zMm: 6000 });
        expect(plan.clickitUpRuns.find((r) => r.id === 'back').terminals.start.kind).toBe('unresolved');
        expect(codes(plan)).toContain('RUN_ENDPOINT_DISCONNECTED');
        expect(getVisualizationExportPolicy(plan.problems, true).allowed).toBe(false);
    });
    it('supports straight zero-depth sketches without treating every product center as inside', () => {
        const plan = buildVisualizationPlan(
            sketch({ depth: 0, depthLeft: 0, depthRight: 0, includeBack: true, parasols: [parasol()] })
        );
        expect(plan.clickitUpRuns).toHaveLength(1);
        expect(plan.clickitUpRuns[0].terminals.start.kind).toBe('free');
        expect(codes(plan)).toContain('PRODUCT_CENTER_OUTSIDE');
    });
    it('retains exact door order and reports unsolved manual counts instead of guessing geometry', () => {
        const plan = buildVisualizationPlan(
            sketch({ doorSegmentsByEdge: { front: [{ index: 1, size: 1000 }] } })
        );
        expect(plan.clickitUpRuns[0].members[1]).toEqual({ index: 1, kind: 'door', lengthMm: 1000 });
        const failed = buildVisualizationPlan(sketch({ sectionCountByEdge: { front: 1 } }));
        expect(failed.clickitUpRuns[0].members).toEqual([]);
        expect(codes(failed)).toContain('RUN_WRONG_MEMBER_COUNT');
    });
    it('preserves unique IDs, reserves later IDs, repairs collisions and omits invalid positions', () => {
        const plan = buildVisualizationPlan(
            sketch({
                parasols: [
                    parasol({ id: '' }),
                    parasol({ id: 'visualization-0' }),
                    parasol({ id: 'visualization-0' }),
                    parasol({ id: 'bad', xMm: NaN })
                ]
            })
        );
        const ids = plan.placedProducts.map((p) => p.instanceId);
        expect(ids[0]).not.toBe('visualization-0');
        expect(ids[1]).toBe('visualization-0');
        expect(new Set(ids).size).toBe(3);
        expect(codes(plan).filter((c) => c === 'PRODUCT_INSTANCE_ID_REPAIRED')).toHaveLength(2);
        expect(codes(plan)).toContain('PRODUCT_DIMENSIONS_INVALID');
        expect(getVisualizationExportPolicy(plan.problems, true).allowed).toBe(false);
    });
    it('maps rotated rectangles into the Y-up frame and keeps unknown variants distinct', () => {
        const plan = buildVisualizationPlan(
            sketch({
                parasols: [
                    parasol({ presetId: 'parasol_4x3', widthMm: 4000, rotationDeg: 90, xMm: 1000, yMm: 1500 })
                ]
            })
        );
        const p = plan.placedProducts[0];
        expect(p.center).toEqual({ xMm: 1000, zMm: 4500 });
        expect(p.rotationDeg).toBe(90);
        const points = rectanglePoints(p);
        expect(points[0].xMm).toBeCloseTo(-500);
        expect(points[0].zMm).toBeCloseTo(6500);
        expect(getJumbrellaDimensions(p)).toEqual({ heightMm: 3090, passageMm: 2400, spokes: 8 });
        const unknown = buildVisualizationPlan(sketch({ parasols: [parasol({ exportModel: 'Other' })] }));
        expect(codes(unknown)).toContain('PRODUCT_KEY_UNKNOWN');
    });
    it('allows canopy overhang and parasol-Fiesta overlap but diagnoses Fiesta boundary and same-type overlaps', () => {
        const fiesta = { id: 'f1', diameterMm: 700, xMm: 100, yMm: 3000 };
        const plan = buildVisualizationPlan(
            sketch({ parasols: [parasol({ xMm: 100 })], fiestaItems: [fiesta] })
        );
        expect(codes(plan)).toEqual(['FIESTA_FOOTPRINT_OUTSIDE']);
        const overlapping = buildVisualizationPlan(
            sketch({ parasols: [parasol(), parasol({ id: 'p2' }), parasol({ id: 'p3' })] })
        );
        expect(overlapping.problems.filter((p) => p.code === 'PRODUCT_OVERLAP')).toHaveLength(3);
    });
    it('keeps the reference case at 30 sections, 4 parasols, 2 Fiesta with no antalsgräns', () => {
        const plan = buildVisualizationPlan(
            sketch({
                width: 20000,
                depth: 20100,
                depthLeft: 20100,
                depthRight: 20100,
                parasols: Array.from({ length: 4 }, (_, i) =>
                    parasol({ id: `p${i}`, xMm: 2500 + i * 4500, yMm: 9000 })
                ),
                fiestaItems: [
                    { id: 'f1', diameterMm: 700, xMm: 2500, yMm: 9000 },
                    { id: 'f2', diameterMm: 700, xMm: 7000, yMm: 9000 }
                ]
            })
        );
        expect(plan.clickitUpRuns.flatMap((r) => r.members)).toHaveLength(30);
        expect(plan.placedProducts).toHaveLength(6);
        expect(plan.problems).toEqual([]);
    });
    it('accepts complete hydrated snapshots and handles old partial payloads with a clear contract failure', () => {
        const state = hydrateQuoteState({ sketchDraft: { config: sketch(), workspace: {} } });
        expect(() => buildVisualizationPlan(state.sketchDraft.config)).not.toThrow();
        const old = hydrateQuoteState({ sketchDraft: { config: { width: 8000 } } });
        expect(() => buildVisualizationPlan(old.sketchDraft.config)).toThrow('PLAN_INVALID');
    });
});
describe('geometry, validation and export policy', () => {
    it('uses positive polygon overlap, including rotated rectangles, not bounding boxes', () => {
        const a = {
            center: { xMm: 0, zMm: 0 },
            rotationDeg: 45,
            footprint: { kind: 'rectangle', widthMm: 4000, depthMm: 300 }
        };
        const b = { ...a, center: { xMm: 500, zMm: 500 } };
        expect(footprintsOverlap(a, b)).toBe(false);
        expect(footprintsOverlap(a, { ...b, center: { xMm: 50, zMm: 50 } })).toBe(true);
        const circle = { footprint: { kind: 'circle', diameterMm: 700 }, center: { xMm: 0, zMm: 0 } };
        expect(footprintsOverlap(circle, { ...circle, center: { xMm: 700, zMm: 0 } })).toBe(false);
        expect(
            pointInFootprint({ xMm: 100, zMm: 2 }, [
                { xMm: 0, zMm: 0 },
                { xMm: 500, zMm: 0 },
                { xMm: 500, zMm: 0 },
                { xMm: 0, zMm: 0 }
            ])
        ).toBe(false);
    });
    it.each([undefined, {}, { schemaVersion: 2 }])('rejects unsupported schema %s', (value) =>
        expect(() => validateVisualizationPlan(value)).toThrow('PLAN_SCHEMA_UNSUPPORTED')
    );
    it('rejects malformed members, axes, missing terminals, nonfinite transforms and broken references', () => {
        for (const mutate of [
            (p) => (p.coordinateSystem.upAxis = 'z'),
            (p) => (p.clickitUpRuns[0].members[0].lengthMm = NaN),
            (p) => delete p.clickitUpRuns[0].terminals.end,
            (p) => (p.clickitUpRuns[0].terminals.start.connectsTo.runId = 'back'),
            (p) => (p.placedProducts[0].rotationDeg = Infinity)
        ]) {
            const p = buildVisualizationPlan(sketch({ parasols: [parasol()] }));
            mutate(p);
            expect(() => validateVisualizationPlan(p)).toThrow('PLAN_INVALID');
        }
    });
    it('blocks omitted/not-ready scenes but allows error/degraded with disclosure', () => {
        const problem = {
            code: 'PRODUCT_CENTER_OUTSIDE',
            entityRef: { kind: 'placed-product', id: 'a' },
            severity: 'error',
            effect: 'degraded'
        };
        expect(getVisualizationExportPolicy([problem], true)).toMatchObject({
            allowed: true,
            disclosure: true
        });
        expect(getVisualizationExportPolicy([{ ...problem, effect: 'omitted' }], true).allowed).toBe(false);
        expect(getVisualizationExportPolicy([], false).allowed).toBe(false);
        expect(getVisualizationExportPolicy([], true).disclosure).toBe(false);
    });
});
