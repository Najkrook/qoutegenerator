import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SceneResources } from './resources';

export const CLICKITUP_ASSET = {
    version: 1,
    url: `${import.meta.env.BASE_URL}assets/visualization/v1/clickitup-source.glb`,
    referenceWidthM: 1.5,
    heightM: 1.413,
    depthM: 0.18,
    spanNames: ['lower-glass-span', 'upper-glass-span', 'top-rail-span'] as const,
    // The DAE contains ends for one section, not verified shared junctions or a door.
    junctionsVerified: false,
    doorVerified: false
};
export type ClickitUpAsset = { root: THREE.Group; spans: THREE.Object3D[]; textureFailed?: boolean };

export function inspectClickitUpAsset(root: THREE.Group): ClickitUpAsset {
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root),
        size = bounds.getSize(new THREE.Vector3());
    if (
        bounds.isEmpty() ||
        [size.x - 1.5, size.y - 1.413, size.z - 0.18, bounds.min.x, bounds.min.y].some(
            (n) => !Number.isFinite(n) || Math.abs(n) > 0.0001
        )
    )
        throw new Error('Invalid ClickitUp bounds');
    const spans = CLICKITUP_ASSET.spanNames.map((name) => {
        const part = root.getObjectByName(name);
        if (!part) throw new Error(`Missing ClickitUp component: ${name}`);
        const b = new THREE.Box3().setFromObject(part),
            s = b.getSize(new THREE.Vector3());
        if (!Number.isFinite(s.x) || s.x < 1.4 || s.x > 1.501) throw new Error('Invalid ClickitUp span');
        return part;
    });
    return { root, spans };
}

export async function loadClickitUpAsset(
    resources: SceneResources,
    signal: AbortSignal
): Promise<ClickitUpAsset> {
    const response = await fetch(CLICKITUP_ASSET.url, { signal });
    if (!response.ok) throw new Error('ClickitUp asset unavailable');
    const bytes = await response.arrayBuffer();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const manager = new THREE.LoadingManager();
    let textureFailed = false;
    manager.onError = () => {
        textureFailed = true;
    };
    const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
    resources.track(gltf.scene);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    gltf.scene.traverse((object) => {
        const materials = (object as THREE.Mesh).material;
        for (const material of Array.isArray(materials) ? materials : [materials])
            if (material?.transparent) {
                material.depthWrite = false;
                material.forceSinglePass = true;
            }
    });
    return { ...inspectClickitUpAsset(gltf.scene), textureFailed };
}

/** Share mesh/material data, change X only, preserve each source span's end margins. */
export function createClickitUpSpan(asset: ClickitUpAsset, widthM: number): THREE.Group {
    const group = new THREE.Group();
    for (const source of asset.spans) {
        const bounds = new THREE.Box3().setFromObject(source);
        const sourceLength = bounds.max.x - bounds.min.x;
        const targetLength = sourceLength + widthM - CLICKITUP_ASSET.referenceWidthM;
        if (targetLength <= 0) throw new Error('Invalid section width');
        const part = source.clone(true);
        part.scale.x = targetLength / sourceLength;
        part.position.x = bounds.min.x * (1 - part.scale.x);
        part.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        group.add(part);
    }
    return group;
}
