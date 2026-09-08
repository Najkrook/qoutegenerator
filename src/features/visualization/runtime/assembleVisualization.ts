import * as THREE from 'three';
import type { VisualizationPlanV1, VisualizationProblemV1 as Problem, PlanPoint } from '../types';
import { combineProblems, entityKey } from '../visualizationProblems';
import { createClickitUpSpan, type ClickitUpAsset } from './clickitupAsset';
import { createModelFactories } from './productModels';
import { SceneResources } from './resources';

export function assembleVisualization(
    plan: VisualizationPlanV1,
    resources: SceneResources,
    asset?: ClickitUpAsset,
    assetFailed = false
) {
    const root = new THREE.Group(),
        entities = new Map<string, THREE.Object3D>(),
        runtimeProblems: Problem[] = [];
    const factories = createModelFactories(resources);
    const addProblem = (
        code: string,
        entityRef: Problem['entityRef'],
        effect: Problem['effect'] = 'degraded'
    ) =>
        runtimeProblems.push({
            code,
            entityRef,
            effect,
            severity: effect === 'omitted' ? 'error' : 'warning'
        });
    const terminalInstances = new Map<string, THREE.Object3D>();
    const point = (p: PlanPoint) => new THREE.Vector3(p.xMm / 1000, 0, p.zMm / 1000);
    for (const run of plan.clickitUpRuns) {
        const group = new THREE.Group();
        root.add(group);
        entities.set(entityKey({ kind: 'run', id: run.id }), group);
        const start = point(run.start),
            end = point(run.end),
            direction = end.clone().sub(start).normalize();
        group.position.copy(start);
        group.rotation.y = -Math.atan2(direction.z, direction.x);
        if (!run.members.length) {
            const geometry = resources.own(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(),
                    new THREE.Vector3(start.distanceTo(end), 0, 0)
                ])
            );
            const line = new THREE.Line(
                geometry,
                resources.own(new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.15, gapSize: 0.1 }))
            );
            line.computeLineDistances();
            group.add(line);
            continue;
        }
        // No verified shared junctions exist in the single-section source asset.
        addProblem('VISUAL_MODEL_SIMPLIFIED', { kind: 'run', id: run.id });
        if (asset?.textureFailed) addProblem('TEXTURE_ASSET_FAILED', { kind: 'run', id: run.id });
        let offset = 0;
        for (const member of run.members) {
            const ref: Problem['entityRef'] = { kind: 'run-member', id: run.id, memberIndex: member.index };
            let model: THREE.Group;
            try {
                if (member.kind === 'section' && asset)
                    model = createClickitUpSpan(asset, member.lengthMm / 1000);
                else {
                    model = factories.simplifiedSpan(member.lengthMm / 1000, member.kind === 'door');
                    addProblem(
                        member.kind === 'section' && assetFailed
                            ? 'VISUAL_MODEL_ASSET_FAILED'
                            : 'VISUAL_MODEL_SIMPLIFIED',
                        ref
                    );
                }
            } catch {
                try {
                    model = factories.simplifiedSpan(member.lengthMm / 1000, member.kind === 'door');
                    addProblem('VISUAL_MODEL_ASSET_FAILED', ref);
                } catch {
                    addProblem('VISUAL_MODEL_FALLBACK_FAILED', ref, 'omitted');
                    offset += member.lengthMm / 1000;
                    continue;
                }
            }
            model.position.x = offset;
            group.add(model);
            entities.set(entityKey(ref), model);
            if (member.index > 0) {
                const junction = factories.junction();
                junction.position.x = offset;
                group.add(junction);
            }
            offset += member.lengthMm / 1000;
        }
        if (run.trailingPostMm)
            factories.box(
                group,
                [run.trailingPostMm / 1000, 1.413, 0.08],
                [offset + run.trailingPostMm / 2000, 0.7065, 0]
            );
        for (const terminalName of ['start', 'end'] as const) {
            const terminal = run.terminals[terminalName];
            if (terminal.kind === 'unresolved') continue;
            let position = point(run[terminalName]);
            let ownerRun = run;
            let ownerTerminal = terminalName;
            let identity = `${run.id}:${terminalName}`;
            if (terminal.kind === 'corner') {
                const other = terminal.connectsTo;
                identity = [identity, `${other.runId}:${other.terminal}`].sort().join('|');
                const neighbor = plan.clickitUpRuns.find((r) => r.id === other.runId)!;
                // The horizontal run owns the shared corner. The explicit 20 mm side
                // setback stays in the plan; no moving a side to "repair" the drawing.
                if (other.runId === 'front' || other.runId === 'back') {
                    position = point(neighbor[other.terminal]);
                    ownerRun = neighbor;
                    ownerTerminal = other.terminal;
                }
                if (!neighbor.members.length) continue;
            }
            if (!terminalInstances.has(identity)) {
                const junction = factories.junction();
                const along = point(ownerRun.end).sub(point(ownerRun.start)).normalize();
                // Keep the fixed terminal within its nominal member span, including side runs.
                junction.position
                    .copy(position)
                    .addScaledVector(along, ownerTerminal === 'start' ? 0.025 : -0.025);
                junction.rotation.y = -Math.atan2(along.z, along.x);
                root.add(junction);
                terminalInstances.set(identity, junction);
            }
        }
    }
    for (const p of plan.placedProducts) {
        const ref: Problem['entityRef'] = { kind: 'placed-product', id: p.instanceId };
        try {
            const { group, simplified } = factories.product(p);
            group.position.copy(point(p.center));
            group.rotation.y = THREE.MathUtils.degToRad(p.rotationDeg);
            root.add(group);
            entities.set(entityKey(ref), group);
            if (simplified) addProblem('VISUAL_MODEL_SIMPLIFIED', ref);
            if (p.productType === 'fiesta.f1-f') addProblem('FIESTA_IDENTITY_UNVERIFIED', ref);
            const f = p.footprint;
            const geometry =
                f.kind === 'circle'
                    ? new THREE.RingGeometry(f.diameterMm / 2000 - 0.008, f.diameterMm / 2000 + 0.008, 40)
                    : new THREE.EdgesGeometry(
                          resources.own(new THREE.BoxGeometry(f.widthMm / 1000, 0.002, f.depthMm / 1000))
                      );
            const footprint =
                f.kind === 'circle'
                    ? new THREE.Mesh(
                          resources.own(geometry),
                          resources.own(
                              new THREE.MeshBasicMaterial({ color: 0xcbd5e1, side: THREE.DoubleSide })
                          )
                      )
                    : new THREE.LineSegments(
                          resources.own(geometry),
                          resources.own(new THREE.LineBasicMaterial({ color: 0xcbd5e1 }))
                      );
            if (f.kind === 'circle') footprint.rotation.x = -Math.PI / 2;
            footprint.position.y = 0.014;
            group.add(footprint);
        } catch {
            addProblem('VISUAL_MODEL_FALLBACK_FAILED', ref, 'omitted');
        }
    }
    for (const problem of plan.problems) {
        const id = entityKey(problem.entityRef);
        if (!problem.location || entities.has(id)) continue;
        const anchor = new THREE.Mesh(
            resources.own(new THREE.TorusGeometry(0.1, 0.02, 8, 24)),
            resources.own(new THREE.MeshBasicMaterial({ color: 0xef4444 }))
        );
        anchor.position.copy(point(problem.location));
        anchor.position.y = 0.04;
        anchor.rotation.x = -Math.PI / 2;
        root.add(anchor);
        entities.set(id, anchor);
    }
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    plan.footprint.points.forEach((p) => bounds.expandByPoint(point(p)));
    const problems = combineProblems(plan.problems, runtimeProblems);
    const markers = new THREE.Group();
    // One marker per entity, strongest severity wins. Color is accompanied by shape + UI text.
    const marked = new Map<string, Problem>();
    for (const p of problems) {
        const id = entityKey(p.entityRef);
        if (!marked.has(id) || p.severity === 'error') marked.set(id, p);
    }
    for (const [id, p] of marked) {
        const entity = entities.get(id);
        if (!entity) continue;
        const color = p.severity === 'error' ? 0xef4444 : 0xfbbf24;
        const box = new THREE.Box3().setFromObject(entity);
        const outline = new THREE.Box3Helper(box, color);
        resources.track(outline);
        markers.add(outline);
        const position = box.getCenter(new THREE.Vector3());
        position.y = box.max.y + 0.18;
        const icon = new THREE.Mesh(
            resources.own(new THREE.OctahedronGeometry(0.09)),
            resources.own(new THREE.MeshBasicMaterial({ color }))
        );
        icon.position.copy(position);
        markers.add(icon);
    }
    for (const run of plan.clickitUpRuns)
        for (const t of ['start', 'end'] as const)
            if (run.terminals[t].kind === 'unresolved') {
                const icon = new THREE.Mesh(
                    resources.own(new THREE.TorusGeometry(0.1, 0.02, 8, 24)),
                    resources.own(new THREE.MeshBasicMaterial({ color: 0xef4444 }))
                );
                icon.position.copy(point(run[t]));
                icon.position.y = 0.05;
                icon.rotation.x = Math.PI / 2;
                markers.add(icon);
            }
    resources.track(root);
    return { root, markers, bounds, entities, problems, terminalCount: terminalInstances.size };
}
