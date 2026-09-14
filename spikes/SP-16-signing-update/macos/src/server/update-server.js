// update-server.js - HTTP server phục vụ manifest và installer cho SP-16/mac
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

if (!fs.existsSync(UPDATES_DIR)) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
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
  } else if (filePath.endsWith('.zip')) {
    contentType = 'application/zip';
  } else if (filePath.endsWith('.dmg')) {
    contentType = 'application/x-apple-diskimage';
  }

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const chunkSize = (end - start) + 1;

    log(`RANGE RESPONSE: ${start}-${end}/${totalSize} (${chunkSize} bytes) -> ${path.basename(filePath)}`);
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    log(`FULL RESPONSE: ${totalSize} bytes -> ${path.basename(filePath)}`);
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  log(`Update Server đang lắng nghe tại http://${HOST}:${PORT}`);
  log(`Phục vụ file từ: ${UPDATES_DIR}`);
});

process.on('SIGTERM', () => {
  log('Đang dừng server...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  log('Đang dừng server...');
  server.close(() => process.exit(0));
});
