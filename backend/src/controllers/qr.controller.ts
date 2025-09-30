import { Response } from 'express';
import { PrismaClient, LogType } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { updateOccupancy, isCapacityFull, getOccupancyStatus } from '../utils/occupancy';
import { findUserSockets } from '../services/socket.service';

const prisma = new PrismaClient();

/**
 * Get current user's QR code
 */
export const getMyQRCode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        qrCode: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({
      message: 'QR code retrieved successfully',
      qrCode: user.qrCode,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Get QR code error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Determine if the next log should be ENTRY or EXIT
 * If last log was EXIT or no logs exist → ENTRY
 * If last log was ENTRY → EXIT
 */
const determineLogType = async (userId: string): Promise<LogType> => {
  const lastLog = await prisma.entryExitLog.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' }
  });
  
  if (!lastLog || lastLog.type === LogType.EXIT) {
    return LogType.ENTRY;
  }
  
  return LogType.EXIT;
};

/**
 * Scan QR code and create entry/exit log
 */
export const scanQRCode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { qrCode } = req.body;
    
    if (!qrCode) {
      return res.status(400).json({ error: 'QR code is required' });
    }
    
    // Find user by QR code
    const user = await prisma.user.findUnique({
      where: { qrCode },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        qrCode: true,
        voluntaryExitScore: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Invalid QR code', message: 'QR code not found in the system' });
    }
    
    // Determine if this should be an ENTRY or EXIT
    const logType = await determineLogType(user.id);
    
    // If ENTRY, check if capacity is full and auto-remove if needed
    if (logType === LogType.ENTRY) {
      const capacityFull = await isCapacityFull();
      if (capacityFull) {
        // Try to auto-remove a user with highest removal score
        const { autoRemoveUserForCapacity } = require('../services/removalScore.service');
        const io = req.app.get('io');
        const removalResult = await autoRemoveUserForCapacity(io);
        
        if (!removalResult.removed) {
          return res.status(403).json({ 
            error: 'Library is at maximum capacity',
            message: 'Cannot allow entry. Please try again later.'
          });
        }
        
        // Capacity freed up, continue with entry
        console.log(`✅ Auto-removed ${removalResult.removedUserName} to make room for entry`);
      }
    }
    
    // Create entry/exit log
    const now = new Date();
    const expirationTime = logType === LogType.ENTRY 
      ? new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
      : null;
    
    // Update user fields based on entry/exit
    if (logType === LogType.EXIT) {
      const lastEntry = await prisma.entryExitLog.findFirst({
        where: {
          userId: user.id,
          type: LogType.ENTRY
        },
        orderBy: { timestamp: 'desc' }
      });
      
      const updateData: any = {
        lastActive: now // Update last active on exit
      };
      
      if (lastEntry?.expirationTime && now < lastEntry.expirationTime) {
        // Voluntary exit before expiration - increase cooperative score
        // Use exponential moving average: newScore = (oldScore * 0.8) + (1.0 * 0.2)
        const currentScore = user.voluntaryExitScore || 0.5;
        const newScore = Math.min(1, (currentScore * 0.8) + (1.0 * 0.2));
        updateData.voluntaryExitScore = newScore;
        
        console.log(`📈 Updated voluntary exit score for ${user.email}: ${currentScore.toFixed(2)} → ${newScore.toFixed(2)}`);
      } else if (lastEntry?.expirationTime && now >= lastEntry.expirationTime) {
        // Forced exit after expiration - slightly decrease score
        const currentScore = user.voluntaryExitScore || 0.5;
        const newScore = Math.max(0, (currentScore * 0.95) + (0.3 * 0.05));
        updateData.voluntaryExitScore = newScore;
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
    } else if (logType === LogType.ENTRY) {
      // Calculate frequency (visits per month in last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentEntries = await prisma.entryExitLog.count({
        where: {
          userId: user.id,
          type: LogType.ENTRY,
          timestamp: {
            gte: thirtyDaysAgo
          }
        }
      });
      
      await prisma.user.update({
        where: { id: user.id },
        data: { frequencyUsed: recentEntries }
      });
    }
    
    const log = await prisma.entryExitLog.create({
      data: {
        userId: user.id,
        type: logType,
        expirationTime: expirationTime
      }
    });
    
    // Update occupancy
    const increment = logType === LogType.ENTRY;
    const occupancyStatus = await updateOccupancy(increment);
    
    // Emit Socket.IO events for real-time updates
    const io = req.app.get('io');
    if (io) {
      const percentage = Math.round((occupancyStatus.currentOccupancy / occupancyStatus.maxCapacity) * 100);
      const isAvailable = occupancyStatus.currentOccupancy < occupancyStatus.maxCapacity;
      const isNearCapacity = percentage >= 90;
      const isAtCapacity = occupancyStatus.isAtCapacity;

      // Emit occupancy update to ALL clients (for real-time occupancy display)
      io.emit('occupancy:update', {
        currentOccupancy: occupancyStatus.currentOccupancy,
        maxCapacity: occupancyStatus.maxCapacity,
        percentage,
        isAvailable,
        isNearCapacity,
        isAtCapacity,
        lastUpdated: new Date().toISOString()
      });

      // Emit capacity alerts to ALL clients
      if (isAtCapacity) {
        io.emit('occupancy:alert', {
          type: 'FULL',
          message: 'Library is at maximum capacity!',
          currentOccupancy: occupancyStatus.currentOccupancy,
          maxCapacity: occupancyStatus.maxCapacity,
          percentage,
          isAvailable,
          isNearCapacity,
          isAtCapacity,
          lastUpdated: new Date().toISOString()
        });
      } else if (isNearCapacity) {
        io.emit('occupancy:alert', {
          type: 'WARNING',
          message: 'Library is nearly full!',
          currentOccupancy: occupancyStatus.currentOccupancy,
          maxCapacity: occupancyStatus.maxCapacity,
          percentage,
          isAvailable,
          isNearCapacity,
          isAtCapacity,
          lastUpdated: new Date().toISOString()
        });
      }

      // Emit user action notification ONLY to the specific user who entered/exited
      // We need to find the socket for this specific user
      const userSockets = await findUserSockets(io, user.id);
      userSockets.forEach(socket => {
        socket.emit('user:action', {
          type: logType,
          userName: `${user.firstName} ${user.lastName}`,
          userId: user.id,
          timestamp: log.timestamp,
          currentOccupancy: occupancyStatus.currentOccupancy,
          maxCapacity: occupancyStatus.maxCapacity
        });
      });
    }
    
    res.status(200).json({
      success: true,
      type: logType,
      currentOccupancy: occupancyStatus.currentOccupancy,
      maxCapacity: occupancyStatus.maxCapacity,
      isAtCapacity: occupancyStatus.isAtCapacity,
      userName: `${user.firstName} ${user.lastName}`,
      timestamp: log.timestamp,
      expirationTime: expirationTime ? expirationTime.toISOString() : null
    });
  } catch (error: any) {
    console.error('Scan QR code error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Get occupancy status
 */
export const getOccupancy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getOccupancyStatus();
    res.status(200).json(status);
  } catch (error: any) {
    console.error('Get occupancy error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Get current session info for the authenticated user
 */
export const getCurrentSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the most recent entry log for this user
    const latestEntry = await prisma.entryExitLog.findFirst({
      where: {
        userId: userId,
        type: LogType.ENTRY
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!latestEntry) {
      return res.status(200).json({
        hasActiveSession: false,
        message: 'No active session'
      });
    }

    // Check if there's an exit log after this entry
    const exitAfterEntry = await prisma.entryExitLog.findFirst({
      where: {
        userId: userId,
        type: LogType.EXIT,
        timestamp: {
          gt: latestEntry.timestamp
        }
      }
    });

    // If user already exited, no active session
    if (exitAfterEntry) {
      return res.status(200).json({
        hasActiveSession: false,
        message: 'Session completed'
      });
    }

    // Calculate remaining time
    const now = new Date();
    const expirationTime = latestEntry.expirationTime;
    
    if (!expirationTime) {
      return res.status(200).json({
        hasActiveSession: false,
        message: 'Session has no expiration time'
      });
    }

    const remainingMs = expirationTime.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / (1000 * 60)));
    const remainingSeconds = Math.max(0, Math.floor((remainingMs % (1000 * 60)) / 1000));
    const isExpired = remainingMs <= 0;

    res.status(200).json({
      hasActiveSession: !isExpired,
      entryTime: latestEntry.timestamp.toISOString(),
      expirationTime: expirationTime.toISOString(),
      remainingTime: {
        totalMs: Math.max(0, remainingMs),
        minutes: remainingMinutes,
        seconds: remainingSeconds,
        percentage: Math.max(0, Math.min(100, (remainingMs / (60 * 60 * 1000)) * 100))
      },
      isExpired
    });
  } catch (error: any) {
    console.error('Get current session error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

