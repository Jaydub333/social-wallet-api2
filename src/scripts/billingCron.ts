import cron from 'node-cron';
import { SubscriptionService } from '../services/subscriptionService';
import { logger } from '../utils/logger';

const subscriptionService = new SubscriptionService();

// Run monthly billing on the 1st of each month at 2:00 AM
const monthlyBillingJob = cron.schedule('0 2 1 * *', async () => {
  try {
    logger.info('Starting monthly billing process...');
    
    const result = await subscriptionService.processMonthlyBilling();
    
    logger.info('Monthly billing completed', {
      processed: result.processed,
      failed: result.failed
    });
    
    // In production, you might want to send notifications about failed billings
    if (result.failed > 0) {
      logger.warn(`${result.failed} billing processes failed - manual review required`);
      // Send alert to admin team
    }
    
  } catch (error) {
    logger.error('Monthly billing process failed', { error: (error as Error).message });
  }
}, {
  scheduled: false, // Don't start automatically
  timezone: 'UTC'
});

// Function to start the billing cron job
export const startBillingCron = () => {
  monthlyBillingJob.start();
  logger.info('Monthly billing cron job started');
};

// Function to stop the billing cron job
export const stopBillingCron = () => {
  monthlyBillingJob.stop();
  logger.info('Monthly billing cron job stopped');
};

// Manual trigger function for testing
export const triggerBillingManually = async () => {
  logger.info('Manually triggering billing process...');
  
  try {
    const result = await subscriptionService.processMonthlyBilling();
    logger.info('Manual billing completed', result);
    return result;
  } catch (error) {
    logger.error('Manual billing failed', { error: (error as Error).message });
    throw error;
  }
};