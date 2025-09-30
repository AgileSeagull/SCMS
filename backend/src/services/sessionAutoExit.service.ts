import { PrismaClient, LogType } from '@prisma/client';
import { updateOccupancy } from '../utils/occupancy';
import { Server } from 'socket.io';
import { findUserSockets } from './socket.service';

const prisma = new PrismaClient();

export class SessionAutoExitService {
  private io: Server;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Start the auto-exit service that checks for expired sessions every minute
   */
  start() {
    // Check immediately on start
    this.checkAndExitExpiredSessions();

    // Then check every minute
    this.checkInterval = setInterval(() => {
      this.checkAndExitExpiredSessions();
    }, 60000); // 60 seconds

    console.log('✅ Session auto-exit service started (checking every minute)');
  }

  /**
   * Stop the auto-exit service
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Session auto-exit service stopped');
    }
  }

  /**
   * Check for expired sessions and auto-exit users
   */
  private async checkAndExitExpiredSessions() {
    try {
      const now = new Date();

      // Find all entry logs with expired sessions (no exit yet)
      const expiredEntries = await prisma.entryExitLog.findMany({
        where: {
          type: LogType.ENTRY,
          expirationTime: {
            lte: now // Expiration time has passed
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      if (expiredEntries.length === 0) {
        return; // No expired sessions
      }

      // For each expired entry, check if user already exited
      for (const entryLog of expiredEntries) {
        // Check if there's already an exit log after this entry
        const exitLog = await prisma.entryExitLog.findFirst({
          where: {
            userId: entryLog.userId,
            type: LogType.EXIT,
            timestamp: {
              gt: entryLog.timestamp
            }
          }
        });

        // If no exit log found, create one
        if (!exitLog) {
          const exitTimestamp = entryLog.expirationTime || new Date();
          
          await prisma.entryExitLog.create({
            data: {
              userId: entryLog.userId,
              type: LogType.EXIT,
              timestamp: exitTimestamp
            }
          });

          // Update occupancy
          const occupancyStatus = await updateOccupancy(false); // Decrement
          const percentage = Math.round((occupancyStatus.currentOccupancy / occupancyStatus.maxCapacity) * 100);
          
          this.io.emit('occupancy:update', {
            currentOccupancy: occupancyStatus.currentOccupancy,
            maxCapacity: occupancyStatus.maxCapacity,
            percentage,
            isAvailable: occupancyStatus.currentOccupancy < occupancyStatus.maxCapacity,
            isNearCapacity: percentage >= 90,
            isAtCapacity: occupancyStatus.isAtCapacity,
            lastUpdated: new Date().toISOString()
          });

          // Notify the user
          const userSockets = findUserSockets(this.io, entryLog.userId);
          userSockets.forEach(socket => {
            socket.emit('session:expired', {
              message: 'Your 1-hour session has expired. You have been automatically exited.',
              timestamp: exitTimestamp.toISOString()
            });
          });

          console.log(`🔄 Auto-exited user: ${entryLog.user.firstName} ${entryLog.user.lastName} (session expired)`);
        }
      }
    } catch (error) {
      console.error('❌ Error checking expired sessions:', error);
    }
  }

}

