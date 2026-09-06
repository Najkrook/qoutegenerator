// THROWAWAY: reuse ticket 06's visual proxies to evaluate ticket 07's workflow.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createWorkflowScene(host, plan, onContextLost) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    host.append(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Skrivskyddad 3D-scen. Dra för att rotera och nyp eller scrolla för att zooma.');
    const scene = new THREE.Scene();
    const sceneRoot = new THREE.Group();
    scene.add(sceneRoot);
    const camera = new THREE.PerspectiveCamera(39, 1, .05, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * .495;
    const hemi = new THREE.HemisphereLight(0xdff3ff, 0x263027, 2.55);
    const key = new THREE.DirectionalLight(0xfff0d5, 4.8);
    key.position.set(-6, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const fill = new THREE.DirectionalLight(0x79bdff, .85);
    fill.position.set(8, 5, -7);
    scene.add(hemi, key, fill);
        const aluminum = new THREE.MeshStandardMaterial({ color: 0x87939a, roughness: .34, metalness: .72 });
        const charcoal = new THREE.MeshStandardMaterial({ color: 0x252d30, roughness: .46, metalness: .52 });
        const glass = new THREE.MeshPhysicalMaterial({ color: 0x94d7e8, transparent: true, opacity: .3, roughness: .08, transmission: .18, depthWrite: false, side: THREE.DoubleSide });
        const fabric = new THREE.MeshStandardMaterial({ color: 0xe7dfcf, roughness: .86, side: THREE.DoubleSide });
        const stainless = new THREE.MeshStandardMaterial({ color: 0xb6c0c2, roughness: .27, metalness: .86 });
        const fallback = new THREE.MeshStandardMaterial({ color: 0x168fc7, roughness: .62, metalness: .06, transparent: true, opacity: .88 });
        const warning = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

        function box(parent, size, position, material, casts = true) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
            mesh.position.set(...position); mesh.castShadow = casts; mesh.receiveShadow = true; parent.add(mesh); return mesh;
        }
        function cylinder(parent, radii, height, position, material, segments = 20) {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], height, segments), material);
            mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
        }
        function clickitupSection(widthM) {
            const group = new THREE.Group();
            const post = .064;
            box(group, [post, 1.413, .082], [0, .7065, 0], aluminum);
            box(group, [post, 1.413, .082], [widthM, .7065, 0], aluminum);
            box(group, [Math.max(.05, widthM - post), .065, .086], [widthM / 2, 1.07, 0], charcoal);
            box(group, [Math.max(.05, widthM - post), .052, .082], [widthM / 2, 1.387, 0], aluminum);
            box(group, [Math.max(.05, widthM - .11), 1.0, .018], [widthM / 2, .54, 0], glass, false);
            box(group, [Math.max(.05, widthM - .11), .27, .015], [widthM / 2, 1.235, 0], glass, false);
            const cap = cylinder(group, [.04, .04], .026, [0, 1.425, 0], charcoal, 14);
            cap.rotation.z = Math.PI / 2;
            return group;
        }
        function simplifiedDoor(widthM) {
            const group = new THREE.Group();
            box(group, [.06, 1.413, .09], [0, .7065, 0], fallback);
            box(group, [.06, 1.413, .09], [widthM, .7065, 0], fallback);
            box(group, [widthM, .06, .09], [widthM / 2, 1.383, 0], fallback);
            box(group, [widthM - .1, 1.25, .018], [widthM / 2, .69, 0], glass, false);
            box(group, [.03, .17, .05], [widthM * .8, .76, -.05], fallback);
            addWarningMarker(group, [widthM / 2, 1.64, 0]);
            return group;
        }
        function addWarningMarker(parent, position) {
            const marker = new THREE.Mesh(new THREE.OctahedronGeometry(.095, 0), warning); marker.position.set(...position); parent.add(marker);
        }
        function canopyGeometry(product) {
            const halfW = product.widthM / 2, halfD = product.depthM / 2;
            const rim = [[-halfW,-halfD],[0,-halfD],[halfW,-halfD],[halfW,0],[halfW,halfD],[0,halfD],[-halfW,halfD],[-halfW,0]];
            const vertices = [0,product.heightM,0]; rim.forEach(([x,z]) => vertices.push(x,product.rimM,z));
            const indices = []; for (let i = 0; i < rim.length; i += 1) indices.push(0,i+1,((i+1)%rim.length)+1);
            const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
        }
        function beamBetween(start, end, thickness) {
            const direction = end.clone().sub(start); const length = direction.length();
            const beam = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness*.7, length), aluminum);
            beam.position.copy(start).add(end).multiplyScalar(.5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), direction.normalize()); beam.castShadow = true; return beam;
        }
        function jumbrella(product) {
            const group = new THREE.Group();
            cylinder(group,[.052,.064],product.heightM,[0,product.heightM/2,0],charcoal,10);
            cylinder(group,[.32,.37],.085,[0,.043,0],charcoal,28);
            const canopy = new THREE.Mesh(canopyGeometry(product),fabric); canopy.castShadow=true; canopy.receiveShadow=true; group.add(canopy);
            const halfW=product.widthM/2, halfD=product.depthM/2;
            [[-halfW,-halfD],[0,-halfD],[halfW,-halfD],[halfW,0],[halfW,halfD],[0,halfD],[-halfW,halfD],[-halfW,0]].forEach(([x,z]) => group.add(beamBetween(new THREE.Vector3(0,product.heightM-.08,0),new THREE.Vector3(x,product.rimM-.03,z),.035)));
            cylinder(group,[.1,.1],.13,[0,product.heightM-.47,0],charcoal,12);
            return group;
        }
        function simplifiedFiesta(product) {
            const group=new THREE.Group();
            cylinder(group,[.15,.28],.18,[0,.09,0],fallback,18);
            cylinder(group,[.055,.065],1.82,[0,1.0,0],fallback,12);
            cylinder(group,[.18,product.diameterM/2],.24,[0,product.heightM-.12,0],fallback,20);
            addWarningMarker(group,[0,product.heightM+.18,0]); return group;
        }
        function addFootprint(parent, product) {
            let geometry;
            if (product.type === 'fiesta') geometry = new THREE.RingGeometry(product.footprintM/2-.018,product.footprintM/2+.018,42);
            else geometry = new THREE.PlaneGeometry(product.widthM,product.depthM);
            const material = new THREE.MeshBasicMaterial({color: product.type==='fiesta'?0xfbbf24:0xffffff,transparent:true,opacity:.14,side:THREE.DoubleSide,wireframe:product.type!=='fiesta'});
            const footprint=new THREE.Mesh(geometry,material); footprint.rotation.x=-Math.PI/2; footprint.position.y=.012; parent.add(footprint);
        }
        function endpointMarker(x,z,color) {
            const marker=new THREE.Mesh(new THREE.TorusGeometry(.1,.022,12,38),new THREE.MeshBasicMaterial({color})); marker.rotation.x=Math.PI/2; marker.position.set(x,.045,z); sceneRoot.add(marker);
        }

    const entities = new Map();
    for (const run of plan.runs) {
        const group = new THREE.Group();
        group.position.set(run.startMm[0] / 1000, 0, run.startMm[1] / 1000);
        group.rotation.y = -Math.atan2(run.direction[1], run.direction[0]);
        if (run.leadingPostMm > 0) box(group, [run.leadingPostMm/1000, 1.413, .08], [run.leadingPostMm/2000, .7065, 0], aluminum);
        let offset = run.leadingPostMm / 1000;
        for (const member of run.members) {
            const model = member.kind === 'door' ? simplifiedDoor(member.lengthMm/1000) : clickitupSection(member.lengthMm/1000);
            model.position.x = offset;
            group.add(model);
            offset += member.lengthMm / 1000;
        }
        if (!run.members.length) {
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(), new THREE.Vector3(run.lengthMm/1000, 0, 0)
            ]), new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: .15, gapSize: .1 }));
            line.computeLineDistances();
            group.add(line);
        }
        sceneRoot.add(group);
        entities.set(run.id, group);
    }
    for (const p of plan.products) {
        const product = { type: p.type, widthM: p.widthMm/1000, depthM: p.depthMm/1000,
            heightM: p.type === 'fiesta' ? 2.26 : 3.01, rimM: 2.3, diameterM: .86, footprintM: p.widthMm/1000 };
        const holder = new THREE.Group();
        holder.position.set(p.centerMm[0]/1000, 0, p.centerMm[1]/1000);
        holder.rotation.y = THREE.MathUtils.degToRad(p.rotationDeg);
        if (p.type === 'fiesta') holder.add(simplifiedFiesta(product));
        else if (p.type === 'jumbrella') holder.add(jumbrella(product));
        else box(holder, [product.widthM, .025, product.depthM], [0, .025, 0], fallback);
        addFootprint(holder, product);
        sceneRoot.add(holder);
        entities.set(p.id, holder);
    }
    const bounds = new THREE.Box3().setFromObject(sceneRoot);
    for (const [x,z] of plan.footprint) bounds.expandByPoint(new THREE.Vector3(x/1000, 0, z/1000));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 3);
    for (const problem of plan.problems) {
        const entity = entities.get(problem.id);
        if (!entity) continue;
        const outline = new THREE.BoxHelper(entity, problem.effect === 'omitted' ? 0xef4444 : 0xfbbf24);
        scene.add(outline);
        const point = new THREE.Box3().setFromObject(entity).getCenter(new THREE.Vector3());
        addWarningMarker(scene, [point.x, 1.7, point.z]);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span*3, span*3),
        new THREE.MeshStandardMaterial({ color: 0x66765a, roughness: 1 }));
    ground.rotation.x = -Math.PI/2;
    ground.position.set(center.x, -.055, center.z);
    ground.receiveShadow = true;
    scene.add(ground);
    const shape = new THREE.Shape();
    plan.footprint.forEach(([x,z], i) => i ? shape.lineTo(x/1000, -z/1000) : shape.moveTo(x/1000, -z/1000));
    shape.closePath();
    const patio = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0xb6ada0, roughness: .9, side: THREE.DoubleSide }));
    patio.rotation.x = -Math.PI/2;
    patio.position.y = -.025;
    patio.receiveShadow = true;
    scene.add(patio);
    const grid = new THREE.GridHelper(span*1.2, Math.min(100, Math.ceil(span*2)), 0x756e66, 0x918980);
    grid.position.set(center.x, -.012, center.z);
    grid.material.transparent = true;
    grid.material.opacity = .25;
    scene.add(grid);
    key.position.set(center.x-span, span*1.5, center.z+span);
    key.target.position.copy(center);
    scene.add(key.target);
    Object.assign(key.shadow.camera, { left:-span, right:span, top:span, bottom:-span, far:span*5 });
    key.shadow.camera.updateProjectionMatrix();
    let fitted = true;
    let topView = false;
    let disposed = false;
    function fit(top = false) {
        fitted = true;
        topView = top;
        const radius = Math.max(size.length()/2, 2);
        const angle = Math.min(THREE.MathUtils.degToRad(camera.fov/2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
        const distance = radius / Math.sin(angle) * 1.12;
        const direction = top ? new THREE.Vector3(0, 1, .001).normalize() : new THREE.Vector3(1, .85, -1).normalize();
        controls.target.copy(center);
        camera.position.copy(center).addScaledVector(direction, distance);
        controls.minDistance = .5;
        controls.maxDistance = Math.max(distance*4, span*5);
        camera.far = Math.max(100, distance*8);
        camera.updateProjectionMatrix();
        controls.update();
    }
    controls.addEventListener('start', () => { fitted = false; });
    function resize() {
        const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height);
        camera.aspect = width/height;
        camera.updateProjectionMatrix();
        if (fitted) fit(topView);
    }
    function style(mode) {
        const technical = mode === 'technical';
        scene.background = new THREE.Color(technical ? 0x071018 : 0xb9d5df);
        ground.material.color.setHex(technical ? 0x17232b : 0x66765a);
        patio.material.color.setHex(technical ? 0x29404d : 0xb6ada0);
    }
    style('environment');
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    function lost(event) { event.preventDefault(); onContextLost(); }
    renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    return {
        fit, style,
        focus(id) {
            const entity = entities.get(id);
            if (!entity) return;
            fitted = false;
            const box = new THREE.Box3().setFromObject(entity);
            const target = box.getCenter(new THREE.Vector3());
            const distance = Math.max(3, box.getSize(new THREE.Vector3()).length()*1.4);
            controls.target.copy(target);
            camera.position.copy(target).addScaledVector(new THREE.Vector3(1,.8,-1).normalize(), distance);
            controls.update();
        },
        async capture(label, disclosure) {
            if (disposed) throw new Error('Scenen är stängd.');
            const width = 2560, height = 1440;
            const originalAspect = camera.aspect;
            const originalRatio = renderer.getPixelRatio();
            const originalSize = renderer.getSize(new THREE.Vector2());
            const output = document.createElement('canvas');
            output.width = width; output.height = height;
            const ctx = output.getContext('2d');
            if (!ctx) throw new Error('Kunde inte skapa bild.');
            try {
                renderer.setPixelRatio(1);
                renderer.setSize(width, height, false);
                // Keep the current camera framing; use letterboxing when viewport and PNG differ.
                renderer.setViewport(0, 0, width, height);
                const renderHeight = Math.min(height-100, width/originalAspect);
                const renderWidth = renderHeight*originalAspect;
                renderer.setViewport((width-renderWidth)/2, (height-100-renderHeight)/2+100, renderWidth, renderHeight);
                renderer.render(scene, camera);
                ctx.drawImage(renderer.domElement, 0, 0);
                ctx.fillStyle = '#101b24'; ctx.fillRect(0,height-100,width,100);
                ctx.fillStyle = '#ffffff'; ctx.font = '24px sans-serif';
                ctx.fillText((label || '3D-skiss').slice(0,140) + ' · Prototyp', 32, height-61, width-64);
                ctx.fillStyle = '#cbd5e1'; ctx.font = '20px sans-serif';
                ctx.fillText(disclosure ? 'Visualiseringen innehåller förenklade modeller eller markerade avvikelser.' : 'Skrivskyddad planeringsvy', 32,height-27,width-64);
                return await new Promise((resolve,reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('Kunde inte skapa bild.')), 'image/png'));
            } finally {
                if (!disposed) {
                    renderer.setPixelRatio(originalRatio);
                    renderer.setSize(originalSize.x,originalSize.y);
                    renderer.setViewport(0,0,originalSize.x,originalSize.y);
                    camera.aspect = originalAspect;
                    camera.updateProjectionMatrix();
                }
            }
        },
        dispose() {
            disposed = true;
            observer.disconnect();
            controls.dispose();
            renderer.setAnimationLoop(null);
            renderer.domElement.removeEventListener('webglcontextlost', lost);
            const geometries = new Set(), materials = new Set();
            scene.traverse(object => {
                if (object.geometry) geometries.add(object.geometry);
                for (const material of (Array.isArray(object.material) ? object.material : [object.material])) if(material) materials.add(material);
            });
            geometries.forEach(geometry => geometry.dispose());
            materials.forEach(material => material.dispose());
            renderer.dispose();
            renderer.domElement.remove();
        }
    };
}
