import { PrismaClient } from '@prisma/client';
import { SubscriptionService } from '../services/subscriptionService';

const prisma = new PrismaClient();
const subscriptionService = new SubscriptionService();

async function seedTestClients() {
  console.log('🌱 Seeding test API clients...');
  
  try {
    // Create test clients for each subscription tier
    const testClients = [
      {
        clientName: 'Facebook Integration',
        callbackUrls: ['https://facebook.com/auth/socialwallet/callback'],
        subscriptionTier: 'enterprise' as const,
        contactEmail: 'dev@facebook.com',
        companyName: 'Meta Platforms Inc.',
        description: 'Facebook social media platform integration'
      },
      {
        clientName: 'TikTok Integration',
        callbackUrls: ['https://tiktok.com/auth/socialwallet/callback'],
        subscriptionTier: 'premium' as const,
        contactEmail: 'dev@tiktok.com',
        companyName: 'ByteDance Ltd.',
        description: 'TikTok short-form video platform integration'
      },
      {
        clientName: 'StartupApp',
        callbackUrls: ['https://mystartup.com/auth/callback'],
        subscriptionTier: 'basic' as const,
        contactEmail: 'dev@mystartup.com',
        companyName: 'MyStartup Inc.',
        description: 'New social media startup testing Social Wallet integration'
      }
    ];
    
    const createdClients = [];
    
    for (const clientData of testClients) {
      const result = await subscriptionService.registerClient(clientData);
      createdClients.push({
        name: clientData.clientName,
        tier: clientData.subscriptionTier,
        clientId: result.clientId,
        clientSecret: result.clientSecret
      });
      
      console.log(`✅ Created ${clientData.clientName} (${clientData.subscriptionTier})`);
    }
    
    console.log('\n🔑 Test Client Credentials:');
    console.log('================================');
    
    createdClients.forEach(client => {
      console.log(`\n${client.name} (${client.tier.toUpperCase()})`);
      console.log(`Client ID: ${client.clientId}`);
      console.log(`Client Secret: ${client.clientSecret}`);
    });
    
    console.log('\n💡 Use these credentials to test OAuth integrations');
    console.log('📝 Store these securely - client secrets cannot be retrieved later');
    
  } catch (error) {
    console.error('❌ Error seeding clients:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedTestClients();
}

export { seedTestClients };