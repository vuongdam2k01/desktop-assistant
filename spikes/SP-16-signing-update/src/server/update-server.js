// update-server.js - HTTP server phục vụ manifest và installer cho SP-16
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8089;
const HOST = '127.0.0.1';
const UPDATES_DIR = path.join(__dirname, 'updates');
const EVIDENCE_DIR = path.resolve(__dirname, '../../evidence');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}
const LOG_FILE = path.join(EVIDENCE_DIR, 'server-requests.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    console.error('Lỗi ghi server log:', e);
  }
}

const server = http.createServer((req, res) => {
  const rawPath = req.url.split('?')[0];
  const urlPath = decodeURIComponent(rawPath);
  log(`REQUEST: ${req.method} ${req.url} -> Decoded: ${urlPath} (Range: ${req.headers.range || 'none'})`);

  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT }));
    return;
  }

  // Xử lý route /updates/...
  let relativePath = urlPath;
  if (urlPath.startsWith('/updates/')) {
    relativePath = urlPath.replace('/updates/', '');
  } else if (urlPath.startsWith('/updates')) {
    relativePath = urlPath.replace('/updates', '');
  }

  if (relativePath.startsWith('/')) {
    relativePath = relativePath.substring(1);
  }

  const filePath = path.join(UPDATES_DIR, relativePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    log(`NOT FOUND: ${filePath}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
    return;
  }

  const stat = fs.statSync(filePath);
  const totalSize = stat.size;

  // Xác định Content-Type
  let contentType = 'application/octet-stream';
  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
    contentType = 'text/yaml; charset=utf-8';
  } else if (filePath.endsWith('.json')) {
    contentType = 'application/json';
  } else if (filePath.endsWith('.exe')) {
    contentType = 'application/vnd.microsoft.portable-executable';
  }

  // Hỗ trợ HTTP Range requests (electron-updater dùng range requests)
  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize) {
      res.writeHead(416, {
        'Content-Range': `bytes */${totalSize}`
      });
      res.end();
      return;
    }

    const chunksize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    log(`SERVE RANGE: ${relativePath} (${start}-${end}/${totalSize} bytes, chunk ${chunksize})`);
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    });
    log(`SERVE FULL: ${relativePath} (${totalSize} bytes)`);
    fs.createReadStream(filePath).pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  log(`=== HTTP UPDATE SERVER SẴN SÀNG TẠI http://${HOST}:${PORT}/updates ===`);
  log(`Phục vụ file từ: ${UPDATES_DIR}`);
});
