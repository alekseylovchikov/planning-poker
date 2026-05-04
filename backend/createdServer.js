import http from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(dirname(__filename)); // project root, not backend/

export const createdServer = http.createServer((req, res) => {
  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'planning-poker' }));
      return;
    }

    const parsedUrl = new URL(
      req.url,
      `http://${req.headers.host || 'localhost'}`,
    );
    let pathname = parsedUrl.pathname;

    const isFileRequest = pathname !== '/' && /\.[^/]+$/.test(pathname);

    const candidates = [];

    if (pathname === '/sw.js') {
      candidates.push(join(__dirname, 'sw.js'));
    }

    if (pathname !== '/') {
      candidates.push(join(__dirname, 'dist', pathname));
      candidates.push(join(__dirname, 'public', pathname));
    }

    if (!isFileRequest) {
      candidates.push(join(__dirname, 'dist', 'index.html'));
    }

    let filePath = candidates.find(
      (p) => existsSync(p) && !statSync(p).isDirectory(),
    );

    if (filePath) {
      const ext = filePath.split('.').pop().toLowerCase();
      const contentTypes = {
        html: 'text/html',
        js: 'application/javascript',
        mjs: 'application/javascript',
        css: 'text/css',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        woff: 'font/woff',
        woff2: 'font/woff2',
        ttf: 'font/ttf',
        txt: 'text/plain',
        map: 'application/json',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';

      try {
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (err) {
        logger.error('Error serving file:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (err) {
    logger.error('Request handling error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});
