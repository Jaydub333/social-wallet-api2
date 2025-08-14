// Vercel serverless function
module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  if (req.url === '/' || req.url === '') {
    return res.json({
      success: true,
      message: '🚀 Social Wallet API is LIVE on Vercel!',
      timestamp: new Date().toISOString(),
      status: 'Working perfectly',
      endpoints: {
        root: '/',
        health: '/health',
        test: '/test'
      }
    });
  }
  
  if (req.url === '/health') {
    return res.json({
      status: 'OK',
      healthy: true,
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.url === '/test') {
    return res.json({
      test: 'PASSED',
      message: 'Your Social Wallet API is working on Vercel!',
      platform: 'Vercel Serverless'
    });
  }
  
  // 404 for other routes
  res.status(404).json({
    error: 'Not Found',
    message: `Path ${req.url} not found`
  });
};