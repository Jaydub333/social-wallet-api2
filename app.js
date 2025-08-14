// Ultra-simple Node.js server without dependencies
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'OK',
      timestamp: new Date().toISOString(),
      message: 'Social Wallet API - Ultra Simple Mode',
      version: '1.0.0'
    }));
    return;
  }

  // Root endpoint
  if (req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      name: 'Social Wallet API',
      version: '1.0.0',
      status: 'Deployment successful - Ultra Simple Mode',
      message: 'Basic deployment working. Ready for full implementation.',
      endpoints: {
        health: '/health',
        documentation: 'See README.md for full API specification'
      }
    }));
    return;
  }

  // 404 for all other routes
  res.writeHead(404);
  res.end(JSON.stringify({
    error: 'Not Found',
    message: 'Endpoint not found in basic mode'
  }));
});

server.listen(port, () => {
  console.log(`Social Wallet API running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});