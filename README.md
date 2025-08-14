# 🚀 Social Wallet API

**The Universal Social Media Profile & Gift Platform**

Social Wallet API allows users to store their social media profile data in one centralized, secure location and enables third-party platforms to provide instant user onboarding through OAuth-style integration. Plus, it features a cross-platform digital gift system that works across all social platforms.

## 🌟 Key Features

### 🔐 Universal Social Profiles
- **One Profile, All Platforms**: Users create one verified profile that works everywhere
- **Instant Onboarding**: "Sign up with Social Wallet" reduces signup time from 5 minutes to 30 seconds
- **Trust & Verification**: Built-in verification system with trust scoring and anti-scam protection
- **Privacy Controls**: Granular permissions - users control what data each platform can access

### 🎁 Cross-Platform Digital Gifts
- **Universal Gift System**: Send gifts that work across all integrated platforms
- **Rich Gift Catalog**: Hearts, roses, diamonds, custom gifts with rarities and animations
- **Revenue Sharing**: Platforms earn 5-15% revenue share on all gift transactions
- **Stripe Integration**: Secure payments with automatic wallet top-ups

### 💼 Enterprise API
- **OAuth 2.0 Standard**: Industry-standard authentication and authorization
- **Subscription Tiers**: Basic ($299), Premium ($999), Enterprise ($2,999)
- **Rate Limiting**: Tier-based request limits with real-time usage tracking
- **Analytics Dashboard**: Comprehensive metrics and revenue analytics

## 💰 Business Model

### Revenue Streams
1. **API Subscriptions**: $299-$2,999/month per platform
2. **Transaction Fees**: 1.5% on all gift transactions
3. **Platform Revenue Share**: 5-15% of gift sales

### Market Opportunity
- **Target**: Social platforms, dating apps, gaming companies
- **TAM**: $320B+ digital gifting market
- **Clients**: Facebook, TikTok, Instagram, Bumble, Discord

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions and rate limiting
- **Payments**: Stripe for processing and webhooks
- **Auth**: JWT tokens with refresh token rotation
- **Security**: OWASP best practices, encryption at rest

### Key Components
- **User Management**: Registration, profiles, verification
- **OAuth System**: Authorization code flow for third-party integration
- **Digital Wallet**: Coin-based economy (100 coins = $1 USD)
- **Gift System**: Universal gifts with platform-specific options
- **Analytics**: Real-time usage and revenue tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Stripe account

### Local Development
```bash
# Clone and install
git clone https://github.com/your-username/social-wallet-api.git
cd social-wallet-api
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run generate
npm run migrate

# Seed test data
npm run seed:clients
npm run seed:gifts

# Start development server
npm run dev
```

### Production Deployment

**DigitalOcean App Platform (Recommended)**
```bash
# Quick deploy to DigitalOcean
# 1. Push to GitHub
# 2. Connect to DigitalOcean App Platform
# 3. Auto-deploys from main branch
# Cost: ~$42-167/month
```

See [deployment-guide.md](deployment-guide.md) for detailed instructions.

## 📚 API Documentation

### Core Endpoints

#### Authentication
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - User login
- `POST /v1/auth/refresh` - Refresh access token

#### User Management
- `GET /v1/users/me` - Get user profile
- `PUT /v1/users/me/profile` - Update profile
- `GET /v1/users/me/media` - Get user media

#### OAuth Integration
- `GET /v1/oauth/authorize` - Start OAuth flow
- `POST /v1/oauth/token` - Exchange code for token
- `GET /v1/integration/profile` - Get user profile (for platforms)

#### Digital Wallet
- `GET /v1/wallet/balance` - Get wallet balance
- `POST /v1/payments/intent` - Create payment intent
- `POST /v1/payments/webhook` - Stripe webhook

#### Gifts
- `GET /v1/gifts/catalog` - Browse gift catalog
- `POST /v1/gifts/send` - Send gift to user
- `GET /v1/gifts/history` - Gift transaction history

### Example Integration

**Platform Integration (TikTok-style)**
```javascript
// 1. User clicks "Sign up with Social Wallet"
window.location = 'https://api.socialwallet.com/v1/oauth/authorize?' +
  'client_id=your_client_id&' +
  'redirect_uri=https://tiktok.com/auth/callback&' +
  'scope=profile,media';

// 2. User authorizes, gets redirected with code
// https://tiktok.com/auth/callback?code=auth_code_here

// 3. Exchange code for access token
const tokenResponse = await fetch('/v1/oauth/token', {
  method: 'POST',
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: auth_code,
    client_id: 'your_client_id',
    client_secret: 'your_secret'
  })
});

// 4. Get user profile data
const profileResponse = await fetch('/v1/integration/profile', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});

// User is now signed up with their Social Wallet profile!
```

**Sending Gifts**
```javascript
// Send a diamond gift (500 coins = $5)
const giftResponse = await fetch('/v1/gifts/send', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}` },
  body: JSON.stringify({
    to_user_id: 'recipient_user_id',
    gift_type_id: 'diamond_gift_id',
    quantity: 1,
    message: 'Amazing content! 💎'
  })
});
```

## 💳 Pricing Tiers

### Basic - $299/month
- 10,000 API requests/month
- 100 requests/minute
- Profile access + Basic verification
- 2% transaction fee on gifts

### Premium - $999/month  
- 50,000 API requests/month
- 500 requests/minute
- All features + Media access + Trust scoring
- 1.5% transaction fee on gifts

### Enterprise - $2,999/month
- Unlimited API requests
- 1,000 requests/minute
- White-label options + Custom integrations
- 1% transaction fee on gifts
- Revenue sharing program

## 📊 Success Metrics

### Current Status
- ✅ MVP Complete: Full-featured API ready for production
- ✅ Security: OWASP compliant, Stripe integrated
- ✅ Scalability: Multi-tenant architecture, Redis caching
- ✅ Documentation: Complete API docs and deployment guides

### Target Metrics (Year 1)
- **Platforms**: 50+ integrated platforms
- **Users**: 1M+ registered users
- **Transaction Volume**: $100M+ in gifts
- **Revenue**: $1.5M+ from transaction fees
- **Clients**: Major platforms like dating apps, social media, gaming

## 🔒 Security & Compliance

### Security Features
- **Data Encryption**: AES-256 encryption at rest
- **API Security**: Rate limiting, input validation, CORS
- **Payment Security**: PCI DSS compliant via Stripe
- **Privacy**: GDPR compliant, granular permissions

### Compliance
- **SOC 2 Type II**: In progress
- **GDPR**: Full compliance with data export/deletion
- **PCI DSS**: Compliant via Stripe integration
- **OWASP**: Follows security best practices

## 🌍 Market Strategy

### Target Customers
1. **Social Media Platforms**: New apps wanting quick user onboarding
2. **Dating Apps**: Reduce fake profiles, instant verified profiles  
3. **Gaming Platforms**: Social features with cross-platform gifting
4. **E-commerce**: Social commerce with verified user profiles

### Competitive Advantages
- **First Mover**: Only API offering universal social profiles + gifting
- **Network Effects**: More platforms = more valuable for users
- **Revenue Model**: Multiple streams vs single subscription model
- **Developer Experience**: OAuth standard, excellent docs, fast integration

## 🤝 Getting Started as a Platform

### Integration Process
1. **Sign up**: Create account at socialwallet.com/partners
2. **Get API Keys**: Receive client_id and client_secret
3. **Choose Plan**: Basic/Premium/Enterprise based on needs
4. **Integrate OAuth**: Follow standard OAuth 2.0 flow
5. **Enable Gifts**: Configure marketplace and revenue sharing
6. **Go Live**: Start getting verified users instantly!

### Support
- **Documentation**: Complete API docs and guides
- **Developer Support**: Dedicated Slack channel
- **Account Management**: Enterprise clients get dedicated support
- **SLA**: 99.9% uptime guarantee

---

## 📞 Contact

- **Website**: [socialwallet.com](https://socialwallet.com)
- **Email**: hello@socialwallet.com
- **Developer Docs**: [docs.socialwallet.com](https://docs.socialwallet.com)
- **Status Page**: [status.socialwallet.com](https://status.socialwallet.com)

**Ready to transform social media onboarding? Let's build the future together! 🚀**