const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3000;

const server = http.createServer((clientReq, clientRes) => {
  const reqUrlStr = clientReq.url;
  // Handle /favicon.ico to prevent errors
  if (reqUrlStr === '/favicon.ico') {
    clientRes.writeHead(204);
    clientRes.end();
    return;
  }

  // 1. Extract Target URL
  // We assume the request is like /?url=https://target.com
  const myUrl = new URL(reqUrlStr, `http://${clientReq.headers.host}`);
  const targetUrlStr = myUrl.searchParams.get('url');

  if (!targetUrlStr) {
    clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
    clientRes.end('Usage: /?url=https://example.com');
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(targetUrlStr);
  } catch (e) {
    clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
    clientRes.end('Error: Invalid URL');
    return;
  }

  // 2. Setup Options
  const lib = targetUrl.protocol === 'https:' ? https : http;
  
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: targetUrl.hostname 
    }
  };

  // 3. Make Request
  const proxyReq = lib.request(options, (proxyRes) => {
    // Forward status and headers
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    // Pipe response data
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(err);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502);
      clientRes.end('Bad Gateway');
    }
  });

  // Pipe request data (for POST bodies)
  clientReq.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
  console.log(`Tunnel running on port ${PORT}`);
});
