// Simple fallback for deployment testing
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Social Wallet API - Fallback Mode'
  });
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Social Wallet API',
    version: '1.0.0',
    status: 'Deployment successful - Basic mode',
    endpoints: {
      health: '/health',
      docs: 'See README.md for full API documentation'
    }
  });
});

app.listen(port, () => {
  console.log(`Social Wallet API running on port ${port}`);
});

module.exports = app;