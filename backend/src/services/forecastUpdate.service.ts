/**
 * Service to automatically update the forecaster when occupancy changes
 */
import { getForecaster } from './crowdForecaster.service';
import { PrismaClient, LogType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Update forecaster with latest observation
 * Called automatically when occupancy changes
 */
export async function updateForecasterWithLatestData(): Promise<void> {
  try {
    const config = await prisma.systemConfig.findFirst();
    if (!config) return;

    const forecaster = getForecaster(config.maxCapacity);

    // Get recent logs to calculate rates
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const recentLogs = await prisma.entryExitLog.findMany({
      where: {
        timestamp: { gte: fiveMinutesAgo }
      }
    });

    const entryCount = recentLogs.filter(l => l.type === LogType.ENTRY).length;
    const exitCount = recentLogs.filter(l => l.type === LogType.EXIT).length;
    const entryRate = entryCount / 5; // per minute
    const exitRate = exitCount / 5; // per minute
    const netRate = entryRate - exitRate;

    // Update forecaster
    forecaster.update({
      timestamp: now,
      occupancy: config.currentOccupancy,
      entryRate,
      exitRate,
      netRate
    });
  } catch (error) {
    // Silently fail - don't break occupancy updates if forecast fails
    console.error('Error updating forecaster:', error);
  }
}

