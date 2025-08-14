#!/bin/bash

# Social Wallet API Deployment Script for DigitalOcean
# Run this script to deploy your API to DigitalOcean App Platform

set -e  # Exit on any error

echo "🚀 Starting Social Wallet API deployment to DigitalOcean..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo -e "${RED}❌ doctl CLI not found. Please install it first:${NC}"
    echo "   brew install doctl  # macOS"
    echo "   or visit: https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

# Check if user is authenticated
if ! doctl auth list &> /dev/null; then
    echo -e "${YELLOW}🔑 Please authenticate with DigitalOcean first:${NC}"
    echo "   doctl auth init"
    exit 1
fi

# Check if app.yaml exists
if [ ! -f ".do/app.yaml" ]; then
    echo -e "${RED}❌ .do/app.yaml not found. Make sure you're in the project root directory.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-deployment checklist:${NC}"
echo "   ✅ doctl CLI installed"
echo "   ✅ DigitalOcean authenticated" 
echo "   ✅ app.yaml configuration found"

# Validate environment variables
echo -e "${YELLOW}🔧 Checking environment configuration...${NC}"

# Check if this is first deployment or update
APP_NAME="social-wallet-api"
if doctl apps list --format Name --no-header | grep -q "^${APP_NAME}$"; then
    echo -e "${BLUE}📱 Existing app found. This will be an update deployment.${NC}"
    DEPLOY_CMD="doctl apps update ${APP_NAME} --spec .do/app.yaml"
else
    echo -e "${BLUE}🆕 No existing app found. This will be a new deployment.${NC}"
    DEPLOY_CMD="doctl apps create --spec .do/app.yaml"
fi

# Ask for confirmation
echo -e "${YELLOW}⚠️  Ready to deploy Social Wallet API to DigitalOcean?${NC}"
echo "   This will:"
echo "   - Deploy the API application"
echo "   - Create PostgreSQL database"
echo "   - Create Redis cache"
echo "   - Set up health checks"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Deploy the application
echo -e "${BLUE}🚀 Deploying application...${NC}"
eval $DEPLOY_CMD

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment initiated successfully!${NC}"
else
    echo -e "${RED}❌ Deployment failed. Check the error message above.${NC}"
    exit 1
fi

# Wait for deployment to complete
echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
echo "   This may take 5-10 minutes for the first deployment."

# Get the app ID
APP_ID=$(doctl apps list --format ID,Name --no-header | grep "${APP_NAME}" | awk '{print $1}')

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ Could not find app ID. Check deployment status manually.${NC}"
    exit 1
fi

# Monitor deployment progress
TIMEOUT=600  # 10 minutes timeout
ELAPSED=0
INTERVAL=30

while [ $ELAPSED -lt $TIMEOUT ]; do
    STATUS=$(doctl apps get $APP_ID --format Phase --no-header 2>/dev/null)
    
    case $STATUS in
        "ACTIVE")
            echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
            break
            ;;
        "ERROR"|"FAILED")
            echo -e "${RED}❌ Deployment failed. Check DigitalOcean console for details.${NC}"
            exit 1
            ;;
        "DEPLOYING"|"PENDING")
            echo -e "${BLUE}⏳ Still deploying... (${ELAPSED}s elapsed)${NC}"
            ;;
        *)
            echo -e "${YELLOW}🔄 Deployment status: $STATUS${NC}"
            ;;
    esac
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo -e "${YELLOW}⏰ Deployment is taking longer than expected. Check DigitalOcean console.${NC}"
fi

# Get app details
echo -e "${BLUE}📊 Getting application details...${NC}"
APP_URL=$(doctl apps get $APP_ID --format DefaultIngress --no-header)

if [ ! -z "$APP_URL" ]; then
    echo -e "${GREEN}🌐 Your API is deployed at: https://$APP_URL${NC}"
    echo ""
    echo -e "${BLUE}🔧 Next steps:${NC}"
    echo "   1. Update your Stripe webhook URL to: https://$APP_URL/v1/payments/webhook"
    echo "   2. Test the health endpoint: https://$APP_URL/health"
    echo "   3. Update your frontend to use: https://$APP_URL"
    echo "   4. Run database migrations: doctl apps logs $APP_ID --type run"
    echo ""
    echo -e "${BLUE}📱 Useful commands:${NC}"
    echo "   View logs: doctl apps logs $APP_ID --follow"
    echo "   Check status: doctl apps get $APP_ID"
    echo "   Update app: doctl apps update $APP_ID --spec .do/app.yaml"
fi

echo -e "${GREEN}🎉 Deployment process completed!${NC}"