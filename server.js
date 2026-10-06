const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/saadmusani/Desktop/louis';
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain',
  '.xml':  'application/xml',
  '.wasm': 'application/wasm',
  '.glb':  'model/gltf-binary',
};

// Pages that map to saved HTML files
const PAGE_MAP = {
  '/':                  'index.html',
  '/mentions-legales':  'mentions-legales.html',
  '/cgv':               'cgv.html',
  '/confidentialite':   'confidentialite.html',
};

const server = http.createServer((req, res) => {
  const fullUrl = req.url;
  let reqPath = decodeURIComponent(fullUrl.split('?')[0]);

  // ── Handle Next.js image optimizer requests /_next/image?url=...&w=...&q=...
  if (reqPath === '/_next/image') {
    const qs = new URLSearchParams(fullUrl.split('?')[1] || '');
    let imgUrl = decodeURIComponent(qs.get('url') || '');
    if (imgUrl && imgUrl.startsWith('/')) {
      let localPath = path.join(ROOT, imgUrl);

      // Try as-is first
      if (fs.existsSync(localPath)) {
        serveFile(localPath, res, imgUrl, req);
        return;
      }

      // Fix over-padded filenames: work-001.jpg → work-01.jpg, work-011.jpg → work-11.jpg
      // Next.js image optimizer sometimes pads differently
      const fixedUrl = imgUrl.replace(/\/work-0*(\d+)(\.\w+)$/, (_, n, ext) => {
        const num = parseInt(n, 10);
        return `/work-${String(num).padStart(2, '0')}${ext}`;
      });
      const fixedPath = path.join(ROOT, fixedUrl);
      if (fs.existsSync(fixedPath)) {
        serveFile(fixedPath, res, fixedUrl, req);
        return;
      }

      // Also try without any directory prefix stripping
      console.log(`  → /_next/image missing: ${imgUrl}`);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404: image not found ' + imgUrl);
    return;
  }

  console.log(`→ ${req.method} ${reqPath}`);

  // Rewrite page routes to their HTML files
  if (PAGE_MAP[reqPath]) {
    const htmlFile = path.join(ROOT, PAGE_MAP[reqPath]);
    serveFile(htmlFile, res, reqPath, req);
    return;
  }

  // Static files (JS, CSS, fonts, images, videos)
  const filePath = path.join(ROOT, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(filePath, res, reqPath, req);
    return;
  }

  // Return 404 for missing static assets (don't serve index.html for JS/CSS/fonts/images)
  const ext = path.extname(reqPath).toLowerCase();
  const isAsset = ['.js','.css','.woff2','.woff','.ttf','.png','.jpg','.jpeg','.svg','.ico','.mp4','.webm','.gif','.webp','.avif'].includes(ext);
  if (isAsset) {
    console.log(`  → 404 asset: ${reqPath}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404: ' + reqPath);
    return;
  }

  // Fallback: serve index.html for page routes (SPA fallback)
  console.log(`  → SPA fallback for ${reqPath}`);
  serveFile(path.join(ROOT, 'index.html'), res, reqPath, req);
});

function serveFile(filePath, res, reqPath, req) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404: ' + reqPath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const size = stat.size;

  // Video range support
  if (req.headers.range && mime.startsWith('video')) {
    const [startStr, endStr] = req.headers.range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : size - 1;
    const chunk = end - start + 1;
    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${size}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunk,
      'Content-Type':   mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type':                mime,
    'Content-Length':              size,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control':               'no-cache',
    'Accept-Ranges':               'bytes',
  });

  fs.createReadStream(filePath).pipe(res);
  const kb = (size / 1024).toFixed(1);
  console.log(`  ✓ ${path.basename(filePath)} (${kb}KB)`);
}

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Saad Musani — Local Server                ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('  🌐  http://localhost:' + PORT);
  console.log('');
  console.log('  Pages:');
  console.log('    http://localhost:' + PORT + '/');
  console.log('    http://localhost:' + PORT + '/mentions-legales');
  console.log('    http://localhost:' + PORT + '/cgv');
  console.log('    http://localhost:' + PORT + '/confidentialite');
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('');
});
