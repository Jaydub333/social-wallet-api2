# 🚀 Social Wallet API Deployment Guide

This guide will walk you through deploying your Social Wallet API to DigitalOcean App Platform.

## 📋 Prerequisites

1. **DigitalOcean Account**: Sign up at [digitalocean.com](https://digitalocean.com) 
2. **GitHub Repository**: Your code needs to be in a GitHub repo
3. **Stripe Account**: For payment processing
4. **Domain Name** (optional): For custom domain

## 🎯 Option 1: One-Click Deploy (Recommended)

### Step 1: Create DigitalOcean Account
1. Visit [digitalocean.com](https://digitalocean.com)
2. Sign up with the link: `https://m.do.co/c/your-referral` (get $200 free credits!)
3. Verify your email and add payment method

### Step 2: Push Code to GitHub
```bash
# Initialize git repository if not done
git init
git add .
git commit -m "Initial Social Wallet API commit"

# Create GitHub repository and push
# 1. Go to github.com and create new repository "social-wallet-api"
# 2. Push your code:
git remote add origin https://github.com/YOUR_USERNAME/social-wallet-api.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy via DigitalOcean Console
1. **Login to DigitalOcean**
2. **Click "Create" > "Apps"**
3. **Choose "GitHub" as source**
4. **Select your `social-wallet-api` repository**
5. **DigitalOcean will auto-detect it's a Node.js app**
6. **Click "Next" through the configuration steps**
7. **Add Environment Variables** (see list below)
8. **Add Database**: PostgreSQL + Redis
9. **Choose Basic plan** ($5/month to start)
10. **Click "Create Resources"**

### Step 4: Configure Environment Variables
In the DigitalOcean console, add these environment variables:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
REFRESH_TOKEN_SECRET=your-refresh-token-secret-min-32-chars
ADMIN_SECRET_KEY=your-admin-secret-key
ALLOWED_ORIGINS=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## 🎯 Option 2: CLI Deploy (Advanced)

### Step 1: Install DigitalOcean CLI
```bash
# macOS
brew install doctl

# Windows (using Chocolatey)
choco install doctl

# Linux
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin
```

### Step 2: Authenticate
```bash
doctl auth init
# Enter your DigitalOcean API token
```

### Step 3: Deploy with App Spec
```bash
# Make sure you're in the project root
cd social-wallet-api

# Update .do/app.yaml with your GitHub repo
# Edit line: "repo: your-username/social-wallet-api"

# Deploy
doctl apps create --spec .do/app.yaml

# Or update existing app
doctl apps update YOUR_APP_ID --spec .do/app.yaml
```

## 🔧 Configuration Steps

### 1. Update GitHub Repository
In `.do/app.yaml`, update this line:
```yaml
github:
  repo: YOUR_GITHUB_USERNAME/social-wallet-api  # Change this!
  branch: main
```

### 2. Set Up Stripe Webhooks
1. **Go to Stripe Dashboard > Webhooks**
2. **Click "Add endpoint"**
3. **URL**: `https://your-app-url.ondigitalocean.app/v1/payments/webhook`
4. **Events to listen for**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.dispute.created`
5. **Copy webhook signing secret** to `STRIPE_WEBHOOK_SECRET`

### 3. Database Setup
The app will automatically run database migrations on first deploy. If you need to run them manually:

```bash
# Connect to your app and run migrations
doctl apps exec YOUR_APP_ID --component api -- npm run migrate
```

### 4. Seed Test Data
```bash
# Seed test clients (Facebook, TikTok, etc.)
doctl apps exec YOUR_APP_ID --component api -- npm run seed:clients

# Seed gift catalog
doctl apps exec YOUR_APP_ID --component api -- npm run seed:gifts
```

## 💰 Cost Breakdown

### Starter Configuration (~$42/month)
- **App**: Basic ($12/month)
- **PostgreSQL**: Basic ($15/month)
- **Redis**: Basic ($15/month)
- **Total**: ~$42/month

### Production Configuration (~$167/month)
- **App**: Professional ($50/month)
- **PostgreSQL**: Professional ($60/month)
- **Redis**: Professional ($40/month)
- **Custom Domain**: $12/year
- **Monitoring**: $17/month
- **Total**: ~$167/month

## 🌐 Custom Domain Setup

### 1. Add Domain to DigitalOcean
```bash
# Add your domain
doctl compute domain create yourdomain.com

# Add DNS records
doctl compute domain records create yourdomain.com \
  --record-type CNAME \
  --record-name api \
  --record-data your-app-name.ondigitalocean.app
```

### 2. Configure SSL
DigitalOcean automatically provisions SSL certificates for custom domains.

## 📊 Monitoring & Logs

### View Application Logs
```bash
# Real-time logs
doctl apps logs YOUR_APP_ID --follow

# Specific service logs
doctl apps logs YOUR_APP_ID --component api --follow
```

### Monitor Performance
1. **DigitalOcean Console**: Built-in metrics dashboard
2. **Health Check**: `https://your-api.com/health`
3. **Application Metrics**: CPU, Memory, Response times

## 🚨 Troubleshooting

### Common Issues

**Deployment Fails:**
```bash
# Check deployment logs
doctl apps logs YOUR_APP_ID --type build

# Check app status
doctl apps get YOUR_APP_ID
```

**Database Connection Issues:**
- Ensure `DATABASE_URL` environment variable is set
- Check if database is in same region as app

**Stripe Webhooks Not Working:**
- Verify webhook URL is correct
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Ensure app is receiving POST requests to `/v1/payments/webhook`

### Environment Variables Not Loading:**
- Check they're set in DigitalOcean console
- Restart app after adding new variables
- Use `type: SECRET` for sensitive values

## 🎉 Success! Your API is Live

Once deployed, your API will be available at:
- **Production URL**: `https://your-app-name.ondigitalocean.app`
- **Health Check**: `https://your-app-name.ondigitalocean.app/health`
- **API Documentation**: `https://your-app-name.ondigitalocean.app/docs` (if you add Swagger)

## 📱 Next Steps

1. **Test all endpoints** with Postman or curl
2. **Set up monitoring** alerts for downtime
3. **Configure CDN** with Cloudflare for better performance
4. **Create staging environment** for testing
5. **Set up CI/CD pipeline** for automated deployments
6. **Monitor costs** and scale as needed

## 🆘 Need Help?

- **DigitalOcean Docs**: [docs.digitalocean.com/products/app-platform](https://docs.digitalocean.com/products/app-platform/)
- **DigitalOcean Community**: [digitalocean.com/community](https://www.digitalocean.com/community/)
- **Support**: Available 24/7 with paid plans

---

**Ready to make millions with your Social Wallet API!** 🚀💰