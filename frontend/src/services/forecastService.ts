import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/forecast`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ForecastDataPoint {
  timestamp: string;
  forecastedOccupancy: number;
  confidence: number;
  percentage: number;
}

export interface CrowdStatus {
  status: 'NORMAL' | 'ALMOST_FULL' | 'FULL';
  percentage: number;
  message: string;
}

export interface HistoricalOccupancy {
  timestamp: string;
  occupancy: number;
}

export interface ForecastResponse {
  success: boolean;
  currentOccupancy: number;
  maxCapacity: number;
  entryRate: number;
  exitRate: number;
  netRate: number;
  historicalOccupancy?: HistoricalOccupancy[]; // Historical data for "Current" line
  forecasts: ForecastDataPoint[];
  crowdStatus: CrowdStatus;
  modelState: {
    level: number;
    trend: number;
    beta: number;
  };
}

/**
 * Get occupancy forecast (Admin only)
 */
export const getForecast = async (minutesAhead: number = 30): Promise<ForecastResponse> => {
  const response = await api.get<ForecastResponse>(`/?minutesAhead=${minutesAhead}`);
  return response.data;
};

/**
 * Initialize forecaster with historical data (Admin only)
 */
export const initializeForecaster = async (): Promise<{ success: boolean; message: string; observationsLoaded: number }> => {
  const response = await api.post('/initialize');
  return response.data;
};

// Export service object for convenience
export const forecastService = {
  getForecast,
  initializeForecaster
};

