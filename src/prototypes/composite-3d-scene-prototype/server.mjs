import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = Number(process.env.COMPOSITE_SCENE_PROTOTYPE_PORT || 4186);
const prototypeRoot = fileURLToPath(new URL('.', import.meta.url));
const threeRoot = 'C:\\Users\\Najk\\Documents\\ChatGPT\\Bahama-visualizer\\node_modules\\three';

const routes = new Map([
    ['/', join(prototypeRoot, 'index.html')],
    ['/index.html', join(prototypeRoot, 'index.html')],
    ['/three.module.js', join(threeRoot, 'build', 'three.module.js')],
    ['/three.core.js', join(threeRoot, 'build', 'three.core.js')],
    ['/OrbitControls.js', join(threeRoot, 'examples', 'jsm', 'controls', 'OrbitControls.js')]
]);

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
};

const server = createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${host}:${port}`);
    const filePath = routes.get(url.pathname);
    if (!filePath || !existsSync(filePath)) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(`Prototype resource not found: ${url.pathname}`);
        return;
    }
    response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream'
    });
    createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
    process.stdout.write(`Composite 3D scene prototype: http://${host}:${port}/?variant=environment\n`);
});
