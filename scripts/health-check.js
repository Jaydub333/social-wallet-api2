#!/usr/bin/env node

// Health check script for Social Wallet API
// Usage: node scripts/health-check.js [API_URL]

const https = require('https');
const http = require('http');

const API_URL = process.argv[2] || process.env.API_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = '/health';

console.log(`🏥 Health checking Social Wallet API at ${API_URL}`);

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const options = {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'SocialWallet-HealthCheck/1.0'
      }
    };

    const req = client.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function checkHealth() {
  const startTime = Date.now();
  
  try {
    console.log('⏳ Checking API health...');
    
    const response = await makeRequest(API_URL + HEALTH_ENDPOINT);
    const responseTime = Date.now() - startTime;
    
    console.log(`📊 Response received in ${responseTime}ms`);
    console.log(`📈 Status Code: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      try {
        const healthData = JSON.parse(response.body);
        console.log('✅ API is healthy!');
        console.log(`🕐 Server time: ${healthData.timestamp}`);
        console.log(`⚡ Response time: ${responseTime}ms`);
        
        // Additional checks
        if (responseTime > 5000) {
          console.log('⚠️  Warning: Response time is slow (>5s)');
        } else if (responseTime > 2000) {
          console.log('⚠️  Warning: Response time is moderate (>2s)');
        } else {
          console.log('🚀 Response time is excellent (<2s)');
        }
        
        process.exit(0);
      } catch (parseError) {
        console.log('⚠️  API responded but with invalid JSON');
        console.log('Response:', response.body);
        process.exit(1);
      }
    } else {
      console.log(`❌ API health check failed with status ${response.statusCode}`);
      console.log('Response:', response.body);
      process.exit(1);
    }
    
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('🔧 Possible issues:');
      console.log('   - API server is not running');
      console.log('   - Wrong URL or port');
      console.log('   - Firewall blocking connection');
    } else if (error.code === 'ENOTFOUND') {
      console.log('🔧 Possible issues:');
      console.log('   - DNS resolution failed');
      console.log('   - Invalid domain name');
      console.log('   - Network connectivity issues');
    } else if (error.message === 'Request timeout') {
      console.log('🔧 Possible issues:');
      console.log('   - API server is overloaded');
      console.log('   - Database connection issues');
      console.log('   - Network latency problems');
    }
    
    process.exit(1);
  }
}

// Run health check
checkHealth();