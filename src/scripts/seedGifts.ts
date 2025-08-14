import { PrismaClient } from '@prisma/client';
import { GiftService } from '../services/giftService';

const prisma = new PrismaClient();
const giftService = new GiftService();

async function seedGifts() {
  console.log('🎁 Seeding gift catalog...');
  
  try {
    // Universal gifts (work on all platforms)
    const universalGifts = [
      {
        name: '❤️ Heart',
        description: 'Show your love with a classic heart',
        priceCoins: 10,
        rarity: 'COMMON' as const,
        category: 'emotions',
        iconUrl: 'https://cdn.socialwallet.com/gifts/heart.png'
      },
      {
        name: '🌹 Rose',
        description: 'A beautiful red rose for someone special',
        priceCoins: 50,
        rarity: 'COMMON' as const,
        category: 'romance',
        iconUrl: 'https://cdn.socialwallet.com/gifts/rose.png'
      },
      {
        name: '⭐ Star',
        description: 'You\'re a star! Light up their day',
        priceCoins: 25,
        rarity: 'COMMON' as const,
        category: 'appreciation',
        iconUrl: 'https://cdn.socialwallet.com/gifts/star.png'
      },
      {
        name: '🔥 Fire',
        description: 'This content is fire!',
        priceCoins: 100,
        rarity: 'RARE' as const,
        category: 'hype',
        iconUrl: 'https://cdn.socialwallet.com/gifts/fire.png'
      },
      {
        name: '💎 Diamond',
        description: 'Premium appreciation for premium content',
        priceCoins: 500,
        rarity: 'EPIC' as const,
        category: 'luxury',
        iconUrl: 'https://cdn.socialwallet.com/gifts/diamond.png'
      },
      {
        name: '👑 Crown',
        description: 'For the kings and queens of content',
        priceCoins: 1000,
        rarity: 'LEGENDARY' as const,
        category: 'royalty',
        iconUrl: 'https://cdn.socialwallet.com/gifts/crown.png'
      },
      {
        name: '🎉 Party',
        description: 'Let\'s celebrate together!',
        priceCoins: 75,
        rarity: 'RARE' as const,
        category: 'celebration',
        iconUrl: 'https://cdn.socialwallet.com/gifts/party.png'
      },
      {
        name: '🚀 Rocket',
        description: 'To the moon! Show your support',
        priceCoins: 200,
        rarity: 'RARE' as const,
        category: 'support',
        iconUrl: 'https://cdn.socialwallet.com/gifts/rocket.png'
      }
    ];

    // Create universal gifts
    for (const gift of universalGifts) {
      await giftService.createGiftType({
        ...gift,
        platformId: undefined // Universal gifts have no platform
      });
      console.log(`✅ Created universal gift: ${gift.name}`);
    }

    // Get some test clients for platform-specific gifts
    const clients = await prisma.apiClient.findMany({
      take: 3
    });

    if (clients.length > 0) {
      // Platform-specific gifts
      const platformGifts = [
        {
          name: '💝 Super Like',
          description: 'Show extra interest in this profile',
          priceCoins: 50,
          rarity: 'COMMON' as const,
          category: 'dating',
          iconUrl: 'https://cdn.socialwallet.com/gifts/super-like.png'
        },
        {
          name: '🎵 Music Note',
          description: 'This beat is amazing!',
          priceCoins: 30,
          rarity: 'COMMON' as const,
          category: 'music',
          iconUrl: 'https://cdn.socialwallet.com/gifts/music-note.png'
        },
        {
          name: '🎮 Gaming Trophy',
          description: 'Outstanding gaming performance',
          priceCoins: 150,
          rarity: 'RARE' as const,
          category: 'gaming',
          iconUrl: 'https://cdn.socialwallet.com/gifts/trophy.png'
        }
      ];

      // Create platform-specific gifts for each client
      for (let i = 0; i < Math.min(clients.length, platformGifts.length); i++) {
        const client = clients[i];
        const gift = platformGifts[i];
        
        await giftService.createGiftType({
          ...gift,
          platformId: client.id
        });
        
        console.log(`✅ Created platform gift for ${client.clientName}: ${gift.name}`);
      }
    }

    // Create some limited edition gifts
    const limitedGifts = [
      {
        name: '🎃 Halloween Pumpkin',
        description: 'Spooky season special - limited time only!',
        priceCoins: 250,
        rarity: 'EPIC' as const,
        category: 'seasonal',
        isLimited: true,
        maxQuantity: 1000,
        iconUrl: 'https://cdn.socialwallet.com/gifts/pumpkin.png'
      },
      {
        name: '🎄 Christmas Tree',
        description: 'Spread holiday cheer - limited edition!',
        priceCoins: 300,
        rarity: 'EPIC' as const,
        category: 'seasonal',
        isLimited: true,
        maxQuantity: 500,
        iconUrl: 'https://cdn.socialwallet.com/gifts/christmas-tree.png'
      }
    ];

    for (const gift of limitedGifts) {
      await giftService.createGiftType(gift);
      console.log(`✅ Created limited edition gift: ${gift.name} (${gift.maxQuantity} available)`);
    }

    console.log('\n🎁 Gift catalog seeded successfully!');
    console.log('📊 Gift Statistics:');
    
    const giftStats = await prisma.giftType.groupBy({
      by: ['rarity'],
      _count: { id: true }
    });
    
    giftStats.forEach(stat => {
      console.log(`   ${stat.rarity}: ${stat._count.id} gifts`);
    });
    
    const totalGifts = await prisma.giftType.count();
    console.log(`   Total: ${totalGifts} gifts in catalog`);
    
  } catch (error) {
    console.error('❌ Error seeding gifts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedGifts();
}

export { seedGifts };