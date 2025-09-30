import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/removal-scores`,
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

export interface UserRemovalData {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    age: number | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    premiumUser: boolean;
  };
  entryTime: string;
  expirationTime: string | null;
  metrics: {
    timeSpent: number;
    remainingSlotTime: number;
    entryOrder: number;
    totalUsers: number;
    lastActive: string;
    frequencyUsed: number;
    voluntaryExitScore: number;
  };
  removalScore: number;
}

export interface RemovalScoresResponse {
  success: boolean;
  totalActiveUsers: number;
  users: UserRemovalData[];
}

export interface AutoRemoveResponse {
  success: boolean;
  message: string;
  removedUserId?: string;
  removedUserName?: string;
}

export interface RemoveTopNResponse {
  success: boolean;
  removed: number;
  removedUsers: Array<{ userId: string; userName: string; score: number }>;
  message: string;
}

/**
 * Get all active users with their removal scores (Admin only)
 */
export const getRemovalScores = async (): Promise<RemovalScoresResponse> => {
  const response = await api.get<RemovalScoresResponse>('/');
  return response.data;
};

/**
 * Manually trigger auto-removal (Admin only)
 */
export const triggerAutoRemoval = async (): Promise<AutoRemoveResponse> => {
  const response = await api.post<AutoRemoveResponse>('/auto-remove');
  return response.data;
};

/**
 * Manually remove top N users (Admin only)
 */
export const removeTopNUsers = async (count: number): Promise<RemoveTopNResponse> => {
  const response = await api.post<RemoveTopNResponse>('/remove-top', { count });
  return response.data;
};

