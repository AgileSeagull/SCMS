import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getActiveUsersWithRemovalScores, autoRemoveUserForCapacity, removeTopUsers } from '../services/removalScore.service';

/**
 * Get all active users with their removal scores (Admin only)
 */
export const getRemovalScores = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usersWithScores = await getActiveUsersWithRemovalScores();

    res.json({
      success: true,
      totalActiveUsers: usersWithScores.length,
      users: usersWithScores.map(u => ({
        userId: u.userId,
        user: {
          id: u.user.id,
          firstName: u.user.firstName,
          lastName: u.user.lastName,
          email: u.user.email,
          age: u.user.age,
          gender: u.user.gender,
          premiumUser: u.user.premiumUser
        },
        entryTime: u.entryTime.toISOString(),
        expirationTime: u.expirationTime?.toISOString() || null,
        metrics: {
          timeSpent: u.timeSpent,
          remainingSlotTime: u.remainingSlotTime,
          entryOrder: u.entryOrder,
          totalUsers: u.totalUsers,
          lastActive: u.lastActive.toISOString(),
          frequencyUsed: u.frequencyUsed,
          voluntaryExitScore: u.user.voluntaryExitScore
        },
        removalScore: u.removalScore
      }))
    });
  } catch (error: any) {
    console.error('Error fetching removal scores:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Manually trigger auto-removal (Admin only)
 */
export const triggerAutoRemoval = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const io = req.app.get('io');
    const result = await autoRemoveUserForCapacity(io);

    if (result.removed) {
      res.json({
        success: true,
        message: result.message,
        removedUserId: result.removedUserId,
        removedUserName: result.removedUserName
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Auto-removal not triggered'
      });
    }
  } catch (error: any) {
    console.error('Error triggering auto-removal:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Manually remove top N users (Admin only)
 */
export const removeTopNUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { count } = req.body;
    
    if (!count || typeof count !== 'number' || count <= 0) {
      return res.status(400).json({ 
        error: 'Invalid count', 
        message: 'Count must be a positive number' 
      });
    }

    const io = req.app.get('io');
    const result = await removeTopUsers(count, io);

    if (result.success) {
      res.json({
        success: true,
        removed: result.removed,
        removedUsers: result.removedUsers,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        removed: result.removed,
        message: result.message || 'Failed to remove users'
      });
    }
  } catch (error: any) {
    console.error('Error removing top users:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

