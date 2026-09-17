import * as THREE from 'three';

/** One owner for a scene, including detached/partially constructed objects. */
export class SceneResources {
    private resources = new Set<{ dispose: () => void }>();
    private images = new Set<ImageBitmap>();
    private released = new WeakSet<object>();
    private closedImages = new WeakSet<ImageBitmap>();
    private closed = false;
    own<T extends { dispose: () => void }>(resource: T): T {
        if (this.closed) {
            if (!this.released.has(resource)) {
                this.released.add(resource);
                resource.dispose();
            }
            return resource;
        }
        this.resources.add(resource);
        return resource;
    }
    track(root: THREE.Object3D) {
        root.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.geometry) this.own(mesh.geometry);
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of materials)
                if (material) {
                    this.own(material);
                    for (const value of Object.values(material))
                        if (value instanceof THREE.Texture) {
                            this.own(value);
                            const image = value.source?.data;
                            if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
                                this.images.add(image);
                        }
                }
        });
        if (this.closed) {
            this.closeImages();
            this.images.clear();
        }
    }
    dispose() {
        if (this.closed) return;
        this.closed = true;
        this.resources.forEach((resource) => {
            this.released.add(resource);
            resource.dispose();
        });
        this.resources.clear();
        this.closeImages();
        this.images.clear();
    }
    private closeImages() {
        this.images.forEach((image) => {
            if (!this.closedImages.has(image)) {
                this.closedImages.add(image);
                image.close();
            }
        });
    }
}
