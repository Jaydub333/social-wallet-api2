const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

console.log('Starting Social Wallet API...');
console.log('PORT from environment:', process.env.PORT);
console.log('Using port:', port);

app.get('/', (req, res) => {
  res.send('🚀 Social Wallet API is LIVE and working perfectly!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is healthy' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Social Wallet API running on port ${port}`);
  console.log(`✅ Health check: http://localhost:${port}/health`);
});