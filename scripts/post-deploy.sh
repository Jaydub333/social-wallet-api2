#!/bin/bash

# Post-deployment script for Social Wallet API
# This script runs after successful deployment to set up the database

echo "🔧 Running post-deployment setup..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 30

# Run database migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migration failed"
    exit 1
fi

# Generate Prisma client (in case it's not already generated)
echo "🔄 Generating Prisma client..."
npx prisma generate

# Check database connection
echo "🔍 Testing database connection..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.\$connect();
    console.log('✅ Database connection successful');
    await prisma.\$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
"

# Seed basic data (only if tables are empty)
echo "🌱 Seeding initial data..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedIfEmpty() {
  try {
    // Check if any gift types exist
    const giftCount = await prisma.giftType.count();
    
    if (giftCount === 0) {
      console.log('🎁 Seeding gift catalog...');
      // Add basic universal gifts
      await prisma.giftType.createMany({
        data: [
          {
            name: '❤️ Heart',
            description: 'Show your love with a classic heart',
            priceCoins: 10,
            rarity: 'COMMON',
            category: 'emotions',
            iconUrl: 'https://cdn.socialwallet.com/gifts/heart.png'
          },
          {
            name: '🌹 Rose', 
            description: 'A beautiful red rose for someone special',
            priceCoins: 50,
            rarity: 'COMMON',
            category: 'romance',
            iconUrl: 'https://cdn.socialwallet.com/gifts/rose.png'
          },
          {
            name: '⭐ Star',
            description: 'You are a star! Light up their day',
            priceCoins: 25,
            rarity: 'COMMON',
            category: 'appreciation',
            iconUrl: 'https://cdn.socialwallet.com/gifts/star.png'
          },
          {
            name: '💎 Diamond',
            description: 'Premium appreciation for premium content',
            priceCoins: 500,
            rarity: 'EPIC',
            category: 'luxury',
            iconUrl: 'https://cdn.socialwallet.com/gifts/diamond.png'
          }
        ]
      });
      console.log('✅ Basic gift catalog seeded');
    } else {
      console.log('ℹ️  Gift catalog already exists, skipping seed');
    }
    
    await prisma.\$disconnect();
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedIfEmpty();
"

echo "🎉 Post-deployment setup completed successfully!"
echo ""
echo "🌐 Your Social Wallet API is ready!"
echo "📊 Health check: https://\$APP_URL/health"
echo "🔧 Next steps:"
echo "   1. Test the health endpoint"
echo "   2. Set up Stripe webhooks"
echo "   3. Configure your frontend"
echo "   4. Create your first API client"