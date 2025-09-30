import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { getRemovalScores, triggerAutoRemoval, removeTopNUsers } from '../controllers/removalScore.controller';

const router = Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// Get all active users with removal scores
router.get('/', getRemovalScores);

// Manually trigger auto-removal
router.post('/auto-remove', triggerAutoRemoval);

// Manually remove top N users
router.post('/remove-top', removeTopNUsers);

export default router;

