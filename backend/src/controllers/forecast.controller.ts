import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getForecaster, resetForecaster } from '../services/crowdForecaster.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Update forecaster with latest observation and get forecast
 */
export const getForecast = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { minutesAhead = 30 } = req.query;
    const minutes = Math.max(10, Math.min(60, parseInt(minutesAhead as string) || 30));

    // Get current system config
    const config = await prisma.systemConfig.findFirst();
    if (!config) {
      return res.status(500).json({ error: 'System configuration not found' });
    }

    const forecaster = getForecaster(config.maxCapacity);
    forecaster.setMaxCapacity(config.maxCapacity); // Update in case it changed

    // Get recent entry/exit logs to calculate current rates
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const recentLogs = await prisma.entryExitLog.findMany({
      where: {
        timestamp: { gte: fiveMinutesAgo }
      },
      orderBy: { timestamp: 'desc' }
    });

    const entryCount = recentLogs.filter(l => l.type === 'ENTRY').length;
    const exitCount = recentLogs.filter(l => l.type === 'EXIT').length;
    const entryRate = entryCount / 5; // Entries per minute (over 5 minutes)
    const exitRate = exitCount / 5; // Exits per minute
    const netRate = entryRate - exitRate;

    // Update forecaster with current observation
    forecaster.update({
      timestamp: now,
      occupancy: config.currentOccupancy,
      entryRate,
      exitRate,
      netRate
    });

    // Get forecast
    const forecasts = forecaster.forecastMinutes(minutes);

    // Get historical occupancy data (last 30 minutes) for the "Current" line
    const historicalOccupancy: Array<{ timestamp: string; occupancy: number }> = [];
    const historyMinutes = 30;
    const historyInterval = 5; // 5-minute intervals
    
    // Get all logs from the last 30 minutes to calculate occupancy efficiently
    const historyStart = new Date(now.getTime() - historyMinutes * 60 * 1000);
    const allHistoricalLogs = await prisma.entryExitLog.findMany({
      where: {
        timestamp: { gte: historyStart }
      },
      orderBy: { timestamp: 'asc' }
    });
    
    // Get initial occupancy before the history window
    const logsBeforeHistory = await prisma.entryExitLog.findMany({
      where: {
        timestamp: { lt: historyStart }
      },
      orderBy: { timestamp: 'asc' }
    });
    
    // Calculate initial occupancy
    let baseOccupancy = 0;
    for (const log of logsBeforeHistory) {
      if (log.type === 'ENTRY') {
        baseOccupancy++;
      } else if (log.type === 'EXIT') {
        baseOccupancy = Math.max(0, baseOccupancy - 1);
      }
    }
    
    // Generate historical points at intervals
    for (let i = historyMinutes; i >= historyInterval; i -= historyInterval) {
      const historicalTime = new Date(now.getTime() - i * 60 * 1000);
      
      // Calculate occupancy at this point
      let historicalOcc = baseOccupancy;
      for (const log of allHistoricalLogs) {
        if (log.timestamp >= historicalTime) break;
        if (log.type === 'ENTRY') {
          historicalOcc++;
        } else if (log.type === 'EXIT') {
          historicalOcc = Math.max(0, historicalOcc - 1);
        }
      }
      
      historicalOccupancy.push({
        timestamp: historicalTime.toISOString(),
        occupancy: historicalOcc
      });
    }
    
    // Add current occupancy as the last historical point
    historicalOccupancy.push({
      timestamp: now.toISOString(),
      occupancy: config.currentOccupancy
    });

    // Get crowd status for the forecast
    const lastForecast = forecasts[forecasts.length - 1];
    const crowdStatus = forecaster.getCrowdStatus(lastForecast.forecastedOccupancy);

    // Get model state for debugging
    const modelState = forecaster.getState();

    res.json({
      success: true,
      currentOccupancy: config.currentOccupancy,
      maxCapacity: config.maxCapacity,
      entryRate,
      exitRate,
      netRate,
      historicalOccupancy, // Add historical data for "Current" line
      forecasts: forecasts.map(f => ({
        timestamp: f.timestamp.toISOString(),
        forecastedOccupancy: f.forecastedOccupancy,
        confidence: f.confidence,
        percentage: (f.forecastedOccupancy / config.maxCapacity) * 100
      })),
      crowdStatus,
      modelState: {
        level: modelState.level,
        trend: modelState.trend,
        beta: modelState.beta
      }
    });
  } catch (error: any) {
    console.error('Error getting forecast:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Initialize forecaster with historical data
 */
export const initializeForecaster = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await prisma.systemConfig.findFirst();
    if (!config) {
      return res.status(500).json({ error: 'System configuration not found' });
    }

    const forecaster = getForecaster(config.maxCapacity);
    forecaster.setMaxCapacity(config.maxCapacity);
    resetForecaster();

    // Get historical data from last 24 hours
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const logs = await prisma.entryExitLog.findMany({
      where: {
        timestamp: { gte: twentyFourHoursAgo }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Calculate occupancy and rates for each 5-minute window
    const observations = [];
    const windowSize = 5 * 60 * 1000; // 5 minutes

    // Sort logs chronologically
    logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let currentOccupancy = 0;
    const startDate = new Date(twentyFourHoursAgo);

    // Calculate initial occupancy before the period
    const logsBefore = await prisma.entryExitLog.findMany({
      where: {
        timestamp: { lt: startDate }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Calculate occupancy at start of period
    for (const log of logsBefore) {
      if (log.type === 'ENTRY') {
        currentOccupancy++;
      } else if (log.type === 'EXIT') {
        currentOccupancy = Math.max(0, currentOccupancy - 1);
      }
    }

    // Process windows
    for (let startTime = startDate.getTime(); startTime < now.getTime(); startTime += windowSize) {
      const windowStart = new Date(startTime);
      const windowEnd = new Date(startTime + windowSize);

      // Get logs in this window
      const windowLogs = logs.filter(log => 
        log.timestamp >= windowStart && log.timestamp < windowEnd
      );

      // Update occupancy through the window
      let windowOccupancy = currentOccupancy;
      for (const log of windowLogs) {
        if (log.type === 'ENTRY') {
          windowOccupancy++;
        } else if (log.type === 'EXIT') {
          windowOccupancy = Math.max(0, windowOccupancy - 1);
        }
      }

      // Update current occupancy for next window
      currentOccupancy = windowOccupancy;

      // Calculate rates (per minute)
      const entryCount = windowLogs.filter(l => l.type === 'ENTRY').length;
      const exitCount = windowLogs.filter(l => l.type === 'EXIT').length;
      const entryRate = entryCount / 5; // entries per minute
      const exitRate = exitCount / 5; // exits per minute
      const netRate = entryRate - exitRate;

      observations.push({
        timestamp: windowEnd,
        occupancy: windowOccupancy,
        entryRate,
        exitRate,
        netRate
      });
    }

    // Initialize forecaster with historical data
    forecaster.initialize(observations);

    res.json({
      success: true,
      message: 'Forecaster initialized with historical data',
      observationsLoaded: observations.length
    });
  } catch (error: any) {
    console.error('Error initializing forecaster:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

