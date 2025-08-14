const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Social Wallet API is working! 🚀');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is healthy' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});