import React, { useState, useEffect, useRef } from 'react';
import qrService, { SessionInfo } from '../services/qrService';
import { useSocket } from '../hooks/useSocket';

interface SessionTimerProps {
  onSessionExpired?: () => void;
}

const SessionTimer: React.FC<SessionTimerProps> = ({ onSessionExpired }) => {
  const { sessionExpired } = useSocket();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [remainingTime, setRemainingTime] = useState<{ minutes: number; seconds: number; percentage: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchSessionInfoRef = useRef<(() => Promise<void>) | null>(null);

  const fetchSessionInfo = async () => {
    try {
      const info = await qrService.getCurrentSession();
      setSessionInfo(info);
      
      if (info.hasActiveSession && info.remainingTime) {
        setRemainingTime({
          minutes: info.remainingTime.minutes,
          seconds: info.remainingTime.seconds,
          percentage: info.remainingTime.percentage
        });
      } else {
        setRemainingTime(null);
        if (onSessionExpired && sessionInfo?.hasActiveSession) {
          onSessionExpired();
        }
      }
    } catch (error) {
      console.error('Failed to fetch session info:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchSessionInfoRef.current = fetchSessionInfo;

  useEffect(() => {
    if (fetchSessionInfoRef.current) {
      fetchSessionInfoRef.current();
    }

    // Fetch session info every 5 seconds
    fetchIntervalRef.current = setInterval(() => {
      if (fetchSessionInfoRef.current) {
        fetchSessionInfoRef.current();
      }
    }, 5000);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, []);

  // Handle session expired event from socket
  useEffect(() => {
    if (sessionExpired) {
      setSessionInfo({ hasActiveSession: false, message: sessionExpired.message });
      setRemainingTime(null);
      if (onSessionExpired) {
        setTimeout(() => onSessionExpired(), 1000);
      }
    }
  }, [sessionExpired, onSessionExpired]);

  // Update countdown every second if session is active
  useEffect(() => {
    if (!sessionInfo?.hasActiveSession || !remainingTime) return;

    const interval = setInterval(() => {
      if (remainingTime.minutes === 0 && remainingTime.seconds === 0) {
        if (fetchSessionInfoRef.current) {
          fetchSessionInfoRef.current();
        }
        return;
      }

      setRemainingTime(prev => {
        if (!prev) return null;
        
        let newSeconds = prev.seconds - 1;
        let newMinutes = prev.minutes;

        if (newSeconds < 0) {
          newMinutes = Math.max(0, newMinutes - 1);
          newSeconds = 59;
        }

        const totalSeconds = newMinutes * 60 + newSeconds;
        const totalMinutesInHour = 60;
        const newPercentage = (totalSeconds / (totalMinutesInHour * 60)) * 100;

        // Check if time is up
        if (newMinutes === 0 && newSeconds === 0) {
          if (fetchSessionInfoRef.current) {
            fetchSessionInfoRef.current();
          }
          return null;
        }

        return {
          minutes: newMinutes,
          seconds: newSeconds,
          percentage: Math.max(0, newPercentage)
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionInfo?.hasActiveSession, remainingTime]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!sessionInfo?.hasActiveSession) {
    return null; // Don't show timer if no active session
  }

  if (!remainingTime) {
    return null;
  }

  const isLowTime = remainingTime.minutes < 5;
  const isCriticalTime = remainingTime.minutes === 0 && remainingTime.seconds < 60;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isCriticalTime ? 'bg-red-500 animate-pulse' : isLowTime ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
          <h3 className="text-lg font-semibold text-gray-900">Active Session Timer</h3>
        </div>
        <span className={`text-sm font-medium ${
          isCriticalTime ? 'text-red-600' : isLowTime ? 'text-yellow-600' : 'text-gray-600'
        }`}>
          1 Hour Session
        </span>
      </div>

      {/* Timer Display */}
      <div className="mb-4">
        <div className={`text-center mb-3 ${isCriticalTime ? 'text-red-600' : isLowTime ? 'text-yellow-600' : 'text-gray-900'}`}>
          <div className="text-4xl font-bold tabular-nums">
            {String(remainingTime.minutes).padStart(2, '0')}:{String(remainingTime.seconds).padStart(2, '0')}
          </div>
          <p className="text-sm text-gray-500 mt-1">Time Remaining</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            className={`h-4 rounded-full transition-all duration-1000 ${
              isCriticalTime
                ? 'bg-red-500'
                : isLowTime
                ? 'bg-yellow-500'
                : 'bg-gradient-to-r from-green-500 via-blue-500 to-green-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, remainingTime.percentage))}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{Math.round(remainingTime.percentage)}% remaining</span>
          <span>Auto-exit in {remainingTime.minutes}m {remainingTime.seconds}s</span>
        </div>
      </div>

      {/* Warning Messages */}
      {isCriticalTime && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
          <p className="text-sm font-medium text-red-800">
            ⚠️ Your session will expire soon! You will be automatically exited.
          </p>
        </div>
      )}
      {isLowTime && !isCriticalTime && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-800">
            ⏰ Less than 5 minutes remaining in your session.
          </p>
        </div>
      )}

      {sessionInfo.entryTime && (
        <div className="text-xs text-gray-500 mt-2 text-center">
          Entry time: {new Date(sessionInfo.entryTime).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default SessionTimer;

