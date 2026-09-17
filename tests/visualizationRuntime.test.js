import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildVisualizationPlan } from '../src/features/visualization/buildVisualizationPlan';
import { assembleVisualization } from '../src/features/visualization/runtime/assembleVisualization';
import { createClickitUpSpan } from '../src/features/visualization/runtime/clickitupAsset';
import { SceneResources } from '../src/features/visualization/runtime/resources';
import { getVisualizationExportPolicy } from '../src/features/visualization/visualizationProblems';
import { getVisualizationExportLabels } from '../src/services/exportLocalization';
import { sketch, parasol } from './helpers/visualizationFixtures';

describe('visualization assets and assembly', () => {
    it('retains a focusable marker for an omitted product with a known center', () => {
        const owner = new SceneResources();
        const plan = buildVisualizationPlan(sketch({ parasols: [parasol({ widthMm: 0 })] }));
        const result = assembleVisualization(plan, owner);
        expect(result.entities.get('placed-product:p1').position.x).toBe(2);
        expect(getVisualizationExportPolicy(result.problems, true).allowed).toBe(false);
        owner.dispose();
    });
    it('ships a self-contained GLB with semantic source parts and source-sized bounds', () => {
        const bytes = readFileSync(
            new URL('../public/assets/visualization/v1/clickitup-source.glb', import.meta.url)
        );
        expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
        expect(bytes.readUInt32LE(4)).toBe(2);
        expect(bytes.readUInt32LE(8)).toBe(bytes.length);
        const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
        expect(gltf.nodes.map((n) => n.name)).toEqual(
            expect.arrayContaining([
                'lower-glass-span',
                'upper-glass-span',
                'top-rail-span',
                'source-left-end',
                'source-right-end'
            ])
        );
        expect(gltf.images[0]).toMatchObject({ mimeType: 'image/jpeg' });
        expect(gltf.images[0].uri).toBeUndefined();
        expect(gltf.buffers[0].uri).toBeUndefined();
        expect(gltf.nodes.every((n) => !n.matrix && !n.rotation && !n.scale)).toBe(true);
        const bounds = JSON.parse(
            readFileSync(
                new URL('../public/assets/visualization/v1/clickitup-source.json', import.meta.url),
                'utf8'
            )
        );
        expect(bounds.boundsM[0]).toBeCloseTo(1.5, 5);
        expect(bounds.boundsM[1]).toBeCloseTo(1.413, 5);
        expect(bounds.boundsM[2]).toBeCloseTo(0.18, 5);
        expect(bounds.unverified).toContain('verified-door-assembly');
    });
    it('changes only span X while preserving source end margins and sharing geometry', () => {
        const geometry = new THREE.BoxGeometry(1.48, 0.85, 0.006);
        geometry.translate(0.75, 0.9, 0);
        const source = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
        source.updateMatrixWorld();
        const model = createClickitUpSpan({ spans: [source] }, 1);
        const bounds = new THREE.Box3().setFromObject(model);
        expect(bounds.min.x).toBeCloseTo(0.01);
        expect(bounds.max.x).toBeCloseTo(0.99);
        expect(bounds.getSize(new THREE.Vector3()).y).toBeCloseTo(0.85);
        expect(model.children[0].geometry).toBe(geometry);
        expect(source.scale.x).toBe(1);
        geometry.dispose();
        source.material.dispose();
    });
    it('builds one shared corner, preserves entity focus and uses actual product height/rotation', () => {
        const owner = new SceneResources();
        const plan = buildVisualizationPlan(
            sketch({ parasols: [parasol({ presetId: 'parasol_4x3', widthMm: 4000, rotationDeg: 90 })] })
        );
        const result = assembleVisualization(plan, owner);
        expect(result.terminalCount).toBe(4); // two shared front corners + two free back ends
        const p = result.entities.get('placed-product:p1');
        expect(p.rotation.y).toBeCloseTo(Math.PI / 2);
        expect(new THREE.Box3().setFromObject(p).max.y).toBeCloseTo(3.09);
        expect(result.problems.some((p) => p.entityRef.id === 'p1')).toBe(false);
        expect(getVisualizationExportPolicy(result.problems, true)).toMatchObject({
            allowed: true,
            disclosure: true
        });
        owner.dispose();
    });
    it('does not manufacture disconnected junctions and retains a blocked but renderable scene', () => {
        const owner = new SceneResources();
        const result = assembleVisualization(
            buildVisualizationPlan(sketch({ includeBack: true, equalDepth: false, depthLeft: 5000 })),
            owner
        );
        expect(result.terminalCount).toBe(3);
        expect(result.root.children.length).toBeGreaterThan(0);
        expect(getVisualizationExportPolicy(result.problems, true).allowed).toBe(false);
        owner.dispose();
    });
    it('shows an asset failure with complete fallback geometry, Fiesta identity and disclosure', () => {
        const owner = new SceneResources();
        const result = assembleVisualization(
            buildVisualizationPlan(
                sketch({ fiestaItems: [{ id: 'f', xMm: 2000, yMm: 3000, diameterMm: 700 }] })
            ),
            owner,
            undefined,
            true
        );
        expect(result.problems.some((p) => p.code === 'VISUAL_MODEL_ASSET_FAILED')).toBe(true);
        expect(result.problems.some((p) => p.code === 'FIESTA_IDENTITY_UNVERIFIED')).toBe(true);
        expect(result.entities.has('placed-product:f')).toBe(true);
        expect(getVisualizationExportPolicy(result.problems, true).allowed).toBe(true);
        owner.dispose();
    });
    it('disposes shared and late resources once, including detached materials and textures', () => {
        const owner = new SceneResources(),
            g = new THREE.BoxGeometry(),
            texture = new THREE.Texture(),
            m = new THREE.MeshStandardMaterial({ map: texture });
        const gd = vi.spyOn(g, 'dispose'),
            md = vi.spyOn(m, 'dispose'),
            td = vi.spyOn(texture, 'dispose');
        const root = new THREE.Group();
        root.add(new THREE.Mesh(g, m), new THREE.Mesh(g, m));
        owner.track(root);
        owner.dispose();
        owner.dispose();
        owner.track(root);
        expect(gd).toHaveBeenCalledTimes(1);
        expect(md).toHaveBeenCalledTimes(1);
        expect(td).toHaveBeenCalledTimes(1);
        const late = new THREE.BoxGeometry(),
            dispose = vi.spyOn(late, 'dispose');
        owner.own(late);
        owner.own(late);
        expect(dispose).toHaveBeenCalledTimes(1);
    });
    it('localizes image disclosure without putting export presentation into the plan', () => {
        expect(getVisualizationExportLabels('en').disclosure).toContain('simplified models');
        expect(getVisualizationExportLabels('sv').disclosure).toContain('förenklade modeller');
        expect(getVisualizationExportLabels('invalid').fallbackLabel).toBe('Aktuell skiss');
    });
});
