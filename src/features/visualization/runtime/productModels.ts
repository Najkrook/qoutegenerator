import * as THREE from 'three';
import type { PlacedProductV1 } from '../types';
import { getJumbrellaDimensions, visualProductRegistry } from '../visualProductRegistry';
import { SceneResources } from './resources';

/** Geometry/materials are shared only within this scene owner. */
export function createModelFactories(resources: SceneResources) {
    const geometryCache = new Map<string, THREE.BufferGeometry>();
    const material = (options: THREE.MeshStandardMaterialParameters) =>
        resources.own(new THREE.MeshStandardMaterial(options));
    const metal = material({ color: 0x293339, roughness: 0.48, metalness: 0.5 });
    const aluminum = material({ color: 0x87939a, roughness: 0.34, metalness: 0.72 });
    const fabric = material({ color: 0xe7dfcf, roughness: 0.86, side: THREE.DoubleSide });
    const blue = material({ color: 0x168fc7, roughness: 0.62 });
    const glass = material({
        color: 0x94d7e8,
        transparent: true,
        opacity: 0.3,
        roughness: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const geometry = (key: string, build: () => THREE.BufferGeometry) => {
        if (!geometryCache.has(key)) geometryCache.set(key, resources.own(build()));
        return geometryCache.get(key)!;
    };
    function mesh(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, position: number[]) {
        const object = new THREE.Mesh(g, m);
        object.position.set(position[0], position[1], position[2]);
        object.castShadow = m !== glass;
        object.receiveShadow = true;
        parent.add(object);
        return object;
    }
    function box(parent: THREE.Object3D, size: number[], position: number[], m: THREE.Material = blue) {
        return mesh(
            parent,
            geometry(`box:${size}`, () => new THREE.BoxGeometry(size[0], size[1], size[2])),
            m,
            position
        );
    }
    function cylinder(
        parent: THREE.Object3D,
        r1: number,
        r2: number,
        height: number,
        position: number[],
        m: THREE.Material = blue
    ) {
        return mesh(
            parent,
            geometry(`cylinder:${r1}:${r2}:${height}`, () => new THREE.CylinderGeometry(r1, r2, height, 16)),
            m,
            position
        );
    }
    function beam(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, thickness = 0.025) {
        const direction = b.clone().sub(a),
            length = direction.length();
        const object = box(
            parent,
            [thickness, thickness * 0.75, length],
            a.clone().add(b).multiplyScalar(0.5).toArray(),
            aluminum
        );
        object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
    }
    function simplifiedSpan(width: number, door = false) {
        const group = new THREE.Group();
        box(group, [width, 0.045, 0.08], [width / 2, 1.39, 0]);
        box(group, [Math.max(0.01, width - 0.05), 1.05, 0.008], [width / 2, 0.525, 0], glass);
        if (door) box(group, [0.025, 0.18, 0.04], [width * 0.8, 0.8, -0.035]);
        else box(group, [Math.max(0.01, width - 0.05), 0.33, 0.006], [width / 2, 1.23, 0], glass);
        return group;
    }
    function junction() {
        const group = new THREE.Group();
        box(group, [0.05, 1.413, 0.18], [0, 0.7065, 0]);
        return group;
    }
    function product(p: PlacedProductV1) {
        const group = new THREE.Group();
        const dimensions = getJumbrellaDimensions(p);
        if (dimensions && p.footprint.kind === 'rectangle') {
            const w = p.footprint.widthMm / 1000,
                d = p.footprint.depthMm / 1000,
                h = dimensions.heightMm / 1000,
                rim = dimensions.passageMm / 1000;
            const rimPoints: number[][] = [];
            // Corners and evenly spaced supports along each side, including 10/12-spoke variants.
            const longSegments = dimensions.spokes === 10 ? 3 : dimensions.spokes === 12 ? 3 : 2;
            const shortSegments = dimensions.spokes === 12 ? 3 : 2;
            const corners = [
                [-w / 2, -d / 2],
                [w / 2, -d / 2],
                [w / 2, d / 2],
                [-w / 2, d / 2]
            ];
            corners.forEach((a, i) => {
                const b = corners[(i + 1) % 4],
                    count = i % 2 === 0 ? longSegments : shortSegments;
                for (let j = 0; j < count; j++)
                    rimPoints.push([a[0] + ((b[0] - a[0]) * j) / count, a[1] + ((b[1] - a[1]) * j) / count]);
            });
            const canopy = geometry(`canopy:${p.variantKey}`, () => {
                const positions = [0, h, 0],
                    indices: number[] = [];
                rimPoints.forEach(([x, z]) => positions.push(x, rim, z));
                rimPoints.forEach((_, i) => indices.push(0, i + 1, ((i + 1) % rimPoints.length) + 1));
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                g.setIndex(indices);
                g.computeVertexNormals();
                return g;
            });
            mesh(group, canopy, fabric, [0, 0, 0]);
            cylinder(group, 0.04, 0.04, h, [0, h / 2, 0], metal);
            const hubY = rim - 0.18;
            cylinder(group, 0.075, 0.075, 0.12, [0, hubY, 0], metal);
            for (const [x, z] of rimPoints) {
                const top = new THREE.Vector3(0, h - 0.04, 0),
                    end = new THREE.Vector3(x, rim - 0.025, z);
                beam(group, top, end);
                beam(group, new THREE.Vector3(0, hubY, 0), top.clone().lerp(end, 0.48), 0.02);
            }
            return { group, simplified: false };
        }
        if (p.productType === 'fiesta.f1-f' && p.footprint.kind === 'circle') {
            const h = visualProductRegistry.fiesta.heightMm / 1000,
                d = visualProductRegistry.fiesta.visibleDiameterMm / 1000;
            cylinder(group, 0.15, 0.28, 0.18, [0, 0.09, 0]);
            cylinder(group, 0.055, 0.065, h - 0.3, [0, (h - 0.3) / 2 + 0.1, 0]);
            cylinder(group, 0.18, d / 2, 0.24, [0, h - 0.12, 0]);
        } else if (p.footprint.kind === 'rectangle') {
            // No unknown product height is invented. A blue footprint represents the known dimensions.
            box(group, [p.footprint.widthMm / 1000, 0.025, p.footprint.depthMm / 1000], [0, 0.0125, 0]);
        } else
            cylinder(
                group,
                p.footprint.diameterMm / 2000,
                p.footprint.diameterMm / 2000,
                0.025,
                [0, 0.0125, 0]
            );
        return { group, simplified: true };
    }
    return { box, junction, simplifiedSpan, product };
}
