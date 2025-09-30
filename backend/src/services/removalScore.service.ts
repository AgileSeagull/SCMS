import { PrismaClient, LogType, Gender } from '@prisma/client';
import { findUserSockets } from './socket.service';
import { updateOccupancy } from '../utils/occupancy';

const prisma = new PrismaClient();

interface UserRemovalData {
  userId: string;
  timeSpent: number;           // minutes stayed
  remainingSlotTime: number;   // minutes left
  entryOrder: number;          // position among entries
  totalUsers: number;          // total inside
  lastActive: Date;            // last visit before this one
  frequencyUsed: number;        // visits per month
  premiumUser: boolean;         // true = premium
  age: number;                  // years
  gender: Gender | null;
  voluntaryExitScore: number;   // 0–1 (1 = always cooperates)
}

interface RemovalScoreOptions {
  maxTime?: number;
  maxSlotTime?: number;
  maxVisits?: number;
  maxAge?: number;
  today?: Date;
  currentHour?: number;         // 0–23
}

/**
 * Calculate removal score for a user
 */
export function calculateRemovalScore(
  user: UserRemovalData,
  options?: RemovalScoreOptions
): number {
  const {
    maxTime = 120,
    maxSlotTime = 120,
    maxVisits = 10,
    maxAge = 70,
    today = new Date(),
    currentHour = new Date().getHours()
  } = options || {};

  // --- Normalizations ---
  const T = Math.min(1, user.timeSpent / maxTime);
  const R = Math.min(1, user.remainingSlotTime / maxSlotTime);
  const O = Math.min(1, user.entryOrder / Math.max(1, user.totalUsers));

  const daysAgo = Math.max(0, (today.getTime() - user.lastActive.getTime()) / (1000 * 60 * 60 * 24));
  let L = 1 - Math.min(1, daysAgo / 30); // recent visit → higher
  L = Math.max(0, L);

  const F = 1 - Math.min(1, user.frequencyUsed / maxVisits); // frequent → safe
  const P = user.premiumUser ? 0 : 1;
  const A = Math.min(1, (maxAge - user.age) / maxAge);
  const G = 0.5; // neutral (we can enhance this later for fairness)
  const V = Math.max(0, Math.min(1, user.voluntaryExitScore));

  // 🕓 Time of Day Normalization (peak hours 9–12, 17–20)
  let D = 0;
  if ((currentHour >= 9 && currentHour <= 12) || (currentHour >= 17 && currentHour <= 20))
    D = 1;          // peak hours → high removal priority
  else if ((currentHour >= 8 && currentHour < 9) || (currentHour > 20 && currentHour <= 21))
    D = 0.5;        // semi-peak
  else
    D = 0.2;        // off-peak

  // --- Weights (sum = 1.0) ---
  const w = { T: 0.20, R: 0.10, O: 0.10, L: 0.08, F: 0.08, P: 0.08, A: 0.05, G: 0.04, V: 0.12, D: 0.15 };

  // --- Weighted Calculation ---
  const score =
    (w.T * T) +
    (w.R * R) +
    (w.O * O) +
    (w.L * L) +
    (w.F * F) +
    (w.P * P) +
    (w.A * A) +
    (w.G * G) +
    (w.V * (1 - V)) + // cooperative users get lower scores
    (w.D * D);        // time of day adjustment

  return Math.min(1, Math.max(0, parseFloat(score.toFixed(3))));
}

/**
 * Get active users (currently inside) with their removal scores
 */
export async function getActiveUsersWithRemovalScores(): Promise<Array<{
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    age: number | null;
    gender: Gender | null;
    premiumUser: boolean;
    voluntaryExitScore: number;
  };
  entryTime: Date;
  expirationTime: Date | null;
  timeSpent: number;
  remainingSlotTime: number;
  entryOrder: number;
  totalUsers: number;
  lastActive: Date;
  frequencyUsed: number;
  removalScore: number;
}>> {
  const now = new Date();
  const currentHour = now.getHours();

  // Get all active users (entered but not exited)
  const allUsers = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    include: {
      entryExitLogs: {
        orderBy: { timestamp: 'asc' }
      }
    }
  });

  // Find currently active users
  const activeUsers: Array<{
    user: typeof allUsers[0];
    entryLog: any;
    entryOrder: number;
    totalUsers: number;
  }> = [];

  for (const user of allUsers) {
    // Get all logs in chronological order
    const logs = user.entryExitLogs;
    
    // Find the most recent entry
    const recentEntries = logs.filter(l => l.type === LogType.ENTRY)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (recentEntries.length === 0) continue;

    const latestEntry = recentEntries[0];
    
    // Check if there's an exit after this entry
    const exitsAfterEntry = logs.filter(l => 
      l.type === LogType.EXIT && 
      l.timestamp > latestEntry.timestamp
    );

    // If no exit after entry, user is currently inside
    if (exitsAfterEntry.length === 0) {
      activeUsers.push({
        user,
        entryLog: latestEntry,
        entryOrder: 0, // Will be set below
        totalUsers: 0  // Will be set below
      });
    }
  }

  // Sort by entry time to get entry order
  activeUsers.sort((a, b) => a.entryLog.timestamp.getTime() - b.entryLog.timestamp.getTime());
  const totalActiveUsers = activeUsers.length;

  // Calculate metrics for each active user
  const usersWithScores = await Promise.all(
    activeUsers.map(async (activeUser, index) => {
      const user = activeUser.user;
      const entryLog = activeUser.entryLog;
      
      // Calculate time spent in minutes
      const timeSpent = Math.floor((now.getTime() - entryLog.timestamp.getTime()) / (1000 * 60));
      
      // Calculate remaining slot time
      const expirationTime = entryLog.expirationTime;
      const remainingSlotTime = expirationTime 
        ? Math.max(0, Math.floor((expirationTime.getTime() - now.getTime()) / (1000 * 60)))
        : 0;

      // Entry order (1-based, earliest = 1)
      const entryOrder = index + 1;

      // Use stored lastActive, fallback to createdAt if not set
      let lastActive = user.lastActive || user.createdAt;

      // Use stored frequencyUsed
      const frequencyUsed = user.frequencyUsed || 0;

      // Build user data for score calculation
      const userRemovalData: UserRemovalData = {
        userId: user.id,
        timeSpent,
        remainingSlotTime,
        entryOrder,
        totalUsers: totalActiveUsers,
        lastActive,
        frequencyUsed,
        premiumUser: user.premiumUser,
        age: user.age || 25, // Default age if not set
        gender: user.gender,
        voluntaryExitScore: user.voluntaryExitScore
      };

      const removalScore = calculateRemovalScore(userRemovalData, {
        currentHour,
        today: now
      });

      return {
        userId: user.id,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          age: user.age,
          gender: user.gender,
          premiumUser: user.premiumUser,
          voluntaryExitScore: user.voluntaryExitScore
        },
        entryTime: entryLog.timestamp,
        expirationTime: entryLog.expirationTime,
        timeSpent,
        remainingSlotTime,
        entryOrder,
        totalUsers: totalActiveUsers,
        lastActive,
        frequencyUsed,
        removalScore
      };
    })
  );

  // Sort by removal score (highest first - most likely to be removed)
  return usersWithScores.sort((a, b) => b.removalScore - a.removalScore);
}

/**
 * Automatically remove user with highest removal score when capacity is full
 */
export async function autoRemoveUserForCapacity(io?: any): Promise<{
  removed: boolean;
  removedUserId?: string;
  removedUserName?: string;
  message?: string;
}> {
  try {
    // Check if capacity is full
    const config = await prisma.systemConfig.findFirst();
    if (!config || config.currentOccupancy < config.maxCapacity) {
      return { removed: false, message: 'Capacity not full' };
    }

    // Get active users with removal scores
    const activeUsers = await getActiveUsersWithRemovalScores();

    if (activeUsers.length === 0) {
      return { removed: false, message: 'No active users to remove' };
    }

    // Get user with highest removal score (first in sorted array)
    const userToRemove = activeUsers[0];

    // Create exit log
    const exitLog = await prisma.entryExitLog.create({
      data: {
        userId: userToRemove.userId,
        type: LogType.EXIT,
        timestamp: new Date()
      }
    });

    // Update occupancy
    await updateOccupancy(false); // Decrement

    // Emit Socket.io events
    if (io) {
      const configAfter = await prisma.systemConfig.findFirst();
      if (configAfter) {
        const percentage = Math.round((configAfter.currentOccupancy / configAfter.maxCapacity) * 100);
        io.emit('occupancy:update', {
          currentOccupancy: configAfter.currentOccupancy,
          maxCapacity: configAfter.maxCapacity,
          percentage,
          isAvailable: configAfter.currentOccupancy < configAfter.maxCapacity,
          isNearCapacity: percentage >= 90,
          isAtCapacity: configAfter.currentOccupancy >= configAfter.maxCapacity,
          lastUpdated: configAfter.updatedAt.toISOString()
        });

        // Notify the removed user
        const userSockets = findUserSockets(io, userToRemove.userId);
        userSockets.forEach((socket: any) => {
          socket.emit('user:removed', {
            message: 'You have been automatically removed to make room for new entries.',
            reason: 'Capacity management',
            timestamp: exitLog.timestamp.toISOString()
          });
        });
      }
    }

    return {
      removed: true,
      removedUserId: userToRemove.userId,
      removedUserName: `${userToRemove.user.firstName} ${userToRemove.user.lastName}`,
      message: `Removed ${userToRemove.user.firstName} ${userToRemove.user.lastName} (score: ${userToRemove.removalScore})`
    };
  } catch (error) {
    console.error('Error in auto-remove:', error);
    return { removed: false, message: 'Error removing user' };
  }
}

/**
 * Manually remove top N users with highest removal scores
 */
export async function removeTopUsers(count: number, io?: any): Promise<{
  success: boolean;
  removed: number;
  removedUsers: Array<{ userId: string; userName: string; score: number }>;
  message?: string;
}> {
  try {
    if (count <= 0) {
      return { success: false, removed: 0, removedUsers: [], message: 'Count must be greater than 0' };
    }

    // Get active users with removal scores
    const activeUsers = await getActiveUsersWithRemovalScores();

    if (activeUsers.length === 0) {
      return { success: false, removed: 0, removedUsers: [], message: 'No active users to remove' };
    }

    // Get top N users (sorted by score, highest first)
    const usersToRemove = activeUsers.slice(0, Math.min(count, activeUsers.length));
    const removedUsers: Array<{ userId: string; userName: string; score: number }> = [];

    // Remove each user
    for (const userToRemove of usersToRemove) {
      // Create exit log
      await prisma.entryExitLog.create({
        data: {
          userId: userToRemove.userId,
          type: LogType.EXIT,
          timestamp: new Date()
        }
      });

      // Update occupancy
      await updateOccupancy(false); // Decrement

      removedUsers.push({
        userId: userToRemove.userId,
        userName: `${userToRemove.user.firstName} ${userToRemove.user.lastName}`,
        score: userToRemove.removalScore
      });

      // Notify the removed user via Socket.io
      if (io) {
        const userSockets = findUserSockets(io, userToRemove.userId);
        userSockets.forEach((socket: any) => {
          socket.emit('user:removed', {
            message: 'You have been manually removed to make room for new entries.',
            reason: 'Administrative action',
            timestamp: new Date().toISOString()
          });
        });
      }
    }

    // Emit occupancy update after all removals
    if (io) {
      const configAfter = await prisma.systemConfig.findFirst();
      if (configAfter) {
        const percentage = Math.round((configAfter.currentOccupancy / configAfter.maxCapacity) * 100);
        io.emit('occupancy:update', {
          currentOccupancy: configAfter.currentOccupancy,
          maxCapacity: configAfter.maxCapacity,
          percentage,
          isAvailable: configAfter.currentOccupancy < configAfter.maxCapacity,
          isNearCapacity: percentage >= 90,
          isAtCapacity: configAfter.currentOccupancy >= configAfter.maxCapacity,
          lastUpdated: configAfter.updatedAt.toISOString()
        });
      }
    }

    return {
      success: true,
      removed: removedUsers.length,
      removedUsers,
      message: `Successfully removed ${removedUsers.length} user(s)`
    };
  } catch (error) {
    console.error('Error in remove top users:', error);
    return { success: false, removed: 0, removedUsers: [], message: 'Error removing users' };
  }
}

