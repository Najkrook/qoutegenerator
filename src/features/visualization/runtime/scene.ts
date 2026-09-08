import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
    VisualizationPlanV1,
    VisualizationQuality,
    VisualizationStyle,
    VisualizationProblemV1
} from '../types';
import { validateVisualizationPlan } from '../validateVisualizationPlan';
import { getVisualizationExportPolicy } from '../visualizationProblems';
import { SceneResources } from './resources';
import { loadClickitUpAsset, type ClickitUpAsset } from './clickitupAsset';
import { assembleVisualization } from './assembleVisualization';

export interface VisualizationScene {
    problems: VisualizationProblemV1[];
    focusableIds: string[];
    fit: (top?: boolean) => void;
    focus: (id: string) => void;
    style: (style: VisualizationStyle) => void;
    quality: (quality: VisualizationQuality) => void;
    rotate: (direction: number) => void;
    zoom: (factor: number) => void;
    capture: (label: string, disclosureText: string) => Promise<Blob>;
    dispose: () => void;
}

export async function createVisualizationScene(
    host: HTMLElement,
    input: VisualizationPlanV1,
    signal: AbortSignal,
    onContextLost: () => void
): Promise<VisualizationScene> {
    const plan = validateVisualizationPlan(input),
        resources = new SceneResources();
    let renderer: THREE.WebGLRenderer | undefined,
        controls: OrbitControls | undefined,
        observer: ResizeObserver | undefined;
    let disposed = false,
        contextLost = false,
        capturing = false,
        frame = 0;
    const abort = () => dispose();
    function dispose() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        frame = 0;
        observer?.disconnect();
        controls?.dispose();
        document.removeEventListener('visibilitychange', visibility);
        signal.removeEventListener('abort', abort);
        renderer?.domElement.removeEventListener('webglcontextlost', lost);
        renderer?.domElement.remove();
        resources.dispose();
    }
    function lost(event: Event) {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame);
        frame = 0;
        if (!disposed) onContextLost();
    }
    function visibility() {
        if (document.hidden) {
            cancelAnimationFrame(frame);
            frame = 0;
        } else invalidate();
    }
    // Assigned before listeners start; kept outside try so disposal also covers construction failures.
    let invalidate = () => {};
    signal.addEventListener('abort', abort, { once: true });
    try {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        let asset: ClickitUpAsset | undefined,
            assetFailed = false;
        if (plan.clickitUpRuns.some((r) => r.members.some((m) => m.kind === 'section'))) {
            try {
                asset = await loadClickitUpAsset(resources, signal);
            } catch (error) {
                if (signal.aborted) throw error;
                assetFailed = true;
            }
        }
        if (signal.aborted || disposed) throw new DOMException('Aborted', 'AbortError');
        renderer = resources.own(new THREE.WebGLRenderer({ antialias: true }));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.03;
        const scene = new THREE.Scene(),
            camera = new THREE.PerspectiveCamera(39, 1, 0.05, 1000);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.maxPolarAngle = Math.PI * 0.495;
        controls.minPolarAngle = 0.001;
        renderer.domElement.setAttribute(
            'aria-label',
            'Skrivskyddad 3D-scen. Dra för att rotera och nyp eller scrolla för att zooma.'
        );
        host.append(renderer.domElement);
        const assembled = assembleVisualization(plan, resources, asset, assetFailed);
        scene.add(assembled.root, assembled.markers);
        const bounds = assembled.bounds,
            center = bounds.getCenter(new THREE.Vector3()),
            size = bounds.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.z, 3),
            radius = Math.max(size.length() / 2, 1);
        const hemi = new THREE.HemisphereLight(0xdff3ff, 0x263027, 2.55);
        const key = new THREE.DirectionalLight(0xfff0d5, 4.8);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        resources.own(key.shadow);
        key.position.set(center.x - span, span * 1.5, center.z + span);
        key.target.position.copy(center);
        Object.assign(key.shadow.camera, {
            left: -span,
            right: span,
            top: span,
            bottom: -span,
            near: 0.1,
            far: span * 6
        });
        key.shadow.camera.updateProjectionMatrix();
        const fill = new THREE.DirectionalLight(0x79bdff, 0.85);
        fill.position.set(center.x + span, span, center.z - span);
        scene.add(hemi, key, key.target, fill);
        const ground = new THREE.Mesh(
            resources.own(new THREE.PlaneGeometry(span * 3, span * 3)),
            resources.own(new THREE.MeshStandardMaterial({ color: 0x66765a, roughness: 1 }))
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(center.x, -0.055, center.z);
        ground.receiveShadow = true;
        scene.add(ground);
        const shape = new THREE.Shape();
        plan.footprint.points.forEach((p, i) =>
            i ? shape.lineTo(p.xMm / 1000, -p.zMm / 1000) : shape.moveTo(p.xMm / 1000, -p.zMm / 1000)
        );
        shape.closePath();
        const patio = new THREE.Mesh(
            resources.own(new THREE.ShapeGeometry(shape)),
            resources.own(
                new THREE.MeshStandardMaterial({ color: 0xb6ada0, roughness: 0.9, side: THREE.DoubleSide })
            )
        );
        patio.rotation.x = -Math.PI / 2;
        patio.position.y = -0.025;
        patio.receiveShadow = true;
        scene.add(patio);
        const gridSpan = Math.ceil(span * 1.2);
        const grid = new THREE.GridHelper(gridSpan, gridSpan, 0x756e66, 0x918980);
        grid.position.set(center.x, -0.012, center.z);
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).opacity = 0.25;
        resources.track(grid);
        scene.add(grid);
        // Deterministic, modest context outside the footprint; excluded from camera bounds.
        const vegetation = new THREE.Group();
        const shrubGeometry = resources.own(new THREE.IcosahedronGeometry(0.24, 1));
        const shrubMaterial = resources.own(
            new THREE.MeshStandardMaterial({ color: 0x526b46, roughness: 1 })
        );
        for (let i = 0; i < 5; i++) {
            const shrub = new THREE.Mesh(shrubGeometry, shrubMaterial);
            shrub.position.set(bounds.min.x - 0.55, 0.08, center.z + (i - 2) * 0.6);
            shrub.castShadow = true;
            vegetation.add(shrub);
        }
        scene.add(vegetation);
        let fitted = true,
            topView = false;
        const distanceFor = (r: number) =>
            (r /
                Math.sin(
                    Math.min(
                        THREE.MathUtils.degToRad(camera.fov / 2),
                        Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)
                    )
                )) *
            1.12;
        invalidate = () => {
            if (disposed || contextLost || capturing || document.hidden || frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                if (disposed || contextLost || capturing) return;
                const changed = controls!.update();
                renderer!.render(scene, camera);
                if (changed) invalidate();
            });
        };
        controls.addEventListener('change', invalidate);
        controls.addEventListener('start', () => {
            fitted = false;
        });
        function fit(top = false) {
            fitted = true;
            topView = top;
            const distance = distanceFor(radius);
            const direction = top
                ? new THREE.Vector3(0, 1, 0.001).normalize()
                : new THREE.Vector3(1, 0.85, -1).normalize();
            controls!.target.copy(center);
            camera.position.copy(center).addScaledVector(direction, distance);
            controls!.minDistance = 0.5;
            controls!.maxDistance = Math.max(distance * 4, span * 5);
            camera.far = Math.max(100, distance * 8);
            camera.updateProjectionMatrix();
            controls!.update();
            invalidate();
        }
        function resize() {
            if (disposed || capturing) return;
            const width = Math.max(1, host.clientWidth),
                height = Math.max(1, host.clientHeight);
            renderer!.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            if (fitted) fit(topView);
            else invalidate();
        }
        function style(mode: VisualizationStyle) {
            const technical = mode === 'technical';
            scene.background = new THREE.Color(technical ? 0x071018 : 0xb9d5df);
            ground.material.color.setHex(technical ? 0x17232b : 0x66765a);
            patio.material.color.setHex(technical ? 0x29404d : 0xb6ada0);
            vegetation.visible = !technical;
            invalidate();
        }
        function quality(level: VisualizationQuality) {
            if (disposed || capturing) return;
            renderer!.setPixelRatio(level === 'simple' ? 1 : Math.min(window.devicePixelRatio || 1, 1.8));
            // Shadow-free interactive rendering preserves product geometry and diagnostic markers.
            renderer!.shadowMap.enabled = level !== 'simple';
            resize();
        }
        style('environment');
        quality('normal');
        observer = new ResizeObserver(resize);
        observer.observe(host);
        renderer.domElement.addEventListener('webglcontextlost', lost);
        document.addEventListener('visibilitychange', visibility);
        invalidate();
        const api: VisualizationScene = {
            problems: assembled.problems,
            focusableIds: [...assembled.entities.keys()],
            fit,
            style,
            quality,
            dispose,
            focus(id) {
                const entity = assembled.entities.get(id);
                if (!entity || disposed) return;
                fitted = false;
                const box = new THREE.Box3().setFromObject(entity),
                    target = box.getCenter(new THREE.Vector3());
                controls!.target.copy(target);
                camera.position
                    .copy(target)
                    .addScaledVector(
                        new THREE.Vector3(1, 0.85, -1).normalize(),
                        distanceFor(Math.max(1, box.getSize(new THREE.Vector3()).length() / 2))
                    );
                controls!.update();
                invalidate();
            },
            rotate(direction) {
                fitted = false;
                const offset = camera.position.clone().sub(controls!.target);
                offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), (direction * Math.PI) / 12);
                camera.position.copy(controls!.target).add(offset);
                controls!.update();
                invalidate();
            },
            zoom(factor) {
                fitted = false;
                const offset = camera.position.clone().sub(controls!.target);
                offset.setLength(
                    THREE.MathUtils.clamp(
                        offset.length() * factor,
                        controls!.minDistance,
                        controls!.maxDistance
                    )
                );
                camera.position.copy(controls!.target).add(offset);
                controls!.update();
                invalidate();
            },
            async capture(label, disclosureText) {
                const policy = getVisualizationExportPolicy(
                    assembled.problems,
                    !disposed && !contextLost && !capturing
                );
                if (!policy.allowed) throw new Error('IMAGE_CAPTURE_FAILED');
                capturing = true;
                cancelAnimationFrame(frame);
                frame = 0;
                const original = {
                    aspect: camera.aspect,
                    ratio: renderer!.getPixelRatio(),
                    size: renderer!.getSize(new THREE.Vector2()),
                    viewport: renderer!.getViewport(new THREE.Vector4()),
                    shadows: renderer!.shadowMap.enabled,
                    enabled: controls!.enabled
                };
                controls!.enabled = false;
                let output: HTMLCanvasElement | undefined;
                try {
                    output = document.createElement('canvas');
                    output.width = 2560;
                    output.height = 1440;
                    const ctx = output.getContext('2d');
                    if (!ctx) throw new Error('IMAGE_CAPTURE_FAILED');
                    renderer!.setPixelRatio(1);
                    renderer!.setSize(2560, 1440, false);
                    renderer!.shadowMap.enabled = true;
                    // Keep exactly the selected camera framing; letterbox for differing aspect ratios.
                    const imageHeight = Math.min(1340, 2560 / original.aspect),
                        imageWidth = imageHeight * original.aspect;
                    renderer!.setViewport(
                        (2560 - imageWidth) / 2,
                        (1340 - imageHeight) / 2 + 100,
                        imageWidth,
                        imageHeight
                    );
                    renderer!.render(scene, camera);
                    ctx.drawImage(renderer!.domElement, 0, 0);
                    ctx.fillStyle = '#101b24';
                    ctx.fillRect(0, 1340, 2560, 100);
                    ctx.fillStyle = '#fff';
                    ctx.font = '24px sans-serif';
                    ctx.fillText(label.slice(0, 140), 32, 1380, 2496);
                    if (policy.disclosure) {
                        ctx.fillStyle = '#cbd5e1';
                        ctx.font = '20px sans-serif';
                        ctx.fillText(disclosureText, 32, 1416, 2496);
                    }
                    const blob = await new Promise<Blob>((resolve, reject) =>
                        output.toBlob(
                            (blob) => (blob ? resolve(blob) : reject(new Error('IMAGE_CAPTURE_FAILED'))),
                            'image/png'
                        )
                    );
                    if (disposed || contextLost || signal.aborted) throw new Error('IMAGE_CAPTURE_FAILED');
                    return blob;
                } finally {
                    capturing = false;
                    if (output) {
                        output.width = 0;
                        output.height = 0;
                    }
                    if (!disposed && !contextLost) {
                        renderer!.shadowMap.enabled = original.shadows;
                        renderer!.setPixelRatio(original.ratio);
                        renderer!.setSize(original.size.x, original.size.y);
                        renderer!.setViewport(original.viewport);
                        camera.aspect = original.aspect;
                        camera.updateProjectionMatrix();
                        controls!.enabled = original.enabled;
                        resize();
                        invalidate();
                    }
                }
            }
        };
        return api;
    } catch (error) {
        dispose();
        throw error;
    }
}
