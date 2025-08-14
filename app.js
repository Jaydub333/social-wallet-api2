// Minimal Express app for DigitalOcean
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Social Wallet API - Working!'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Social Wallet API',
    version: '1.0.0',
    status: 'Deployment successful',
    message: 'Your Social Wallet API is now live!',
    endpoints: {
      health: '/health'
    }
  });
});

app.listen(port, () => {
  console.log(`Social Wallet API running on port ${port}`);
});