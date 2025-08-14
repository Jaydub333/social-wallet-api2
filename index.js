// Ultra-simple Node.js app that works EVERYWHERE
const http = require('http');

const port = process.env.PORT || 3000;

console.log('🚀 Starting Social Wallet API...');
console.log('🔧 PORT:', port);
console.log('🔧 NODE_VERSION:', process.version);

const server = http.createServer((req, res) => {
  // Set headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url}`);

  if (req.url === '/' || req.url === '') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      message: '🚀 Social Wallet API is LIVE!',
      timestamp: new Date().toISOString(),
      status: 'Working perfectly',
      endpoints: {
        root: '/',
        health: '/health',
        test: '/test'
      }
    }, null, 2));
  }
  else if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'OK',
      healthy: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }, null, 2));
  }
  else if (req.url === '/test') {
    res.writeHead(200);
    res.end(JSON.stringify({
      test: 'PASSED',
      message: 'Your Social Wallet API is working!',
      port: port,
      nodeVersion: process.version
    }, null, 2));
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `Path ${req.url} not found`
    }, null, 2));
  }
});

server.listen(port, () => {
  console.log('✅ Social Wallet API running on port', port);
  console.log('✅ Try: http://localhost:' + port);
  console.log('✅ Health: http://localhost:' + port + '/health');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});