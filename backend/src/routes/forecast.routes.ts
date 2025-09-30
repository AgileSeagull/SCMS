import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { getForecast, initializeForecaster } from '../controllers/forecast.controller';

const router = Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// Get occupancy forecast
router.get('/', getForecast);

// Initialize forecaster with historical data
router.post('/initialize', initializeForecaster);

export default router;

