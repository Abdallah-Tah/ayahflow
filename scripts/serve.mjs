import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../www'), port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.wasm': 'application/wasm', '.mjs': 'text/javascript; charset=utf-8', '.onnx': 'application/octet-stream' };
http.createServer(async (req, res) => { try {
    let p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (p !== root && !p.startsWith(root + path.sep)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }
    if ((await stat(p)).isDirectory())
        p = path.join(p, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)' });
    res.end(await readFile(p));
}
catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
} }).listen(port, '0.0.0.0', () => console.log(`AyahFlow: http://localhost:${port}`));
