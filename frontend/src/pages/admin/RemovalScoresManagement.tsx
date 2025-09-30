import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRemovalScores, triggerAutoRemoval, removeTopNUsers, UserRemovalData } from '../../services/removalScoreService';

const RemovalScoresManagement: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [usersWithScores, setUsersWithScores] = useState<UserRemovalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRemoving, setAutoRemoving] = useState(false);
  const [removingTopN, setRemovingTopN] = useState(false);
  const [removeCount, setRemoveCount] = useState<number>(1);

  const fetchRemovalScores = async () => {
    try {
      setLoading(true);
      const response = await getRemovalScores();
      setUsersWithScores(response.users);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching removal scores:', err);
      setError(err.response?.data?.message || 'Failed to fetch removal scores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRemovalScores();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchRemovalScores, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleAutoRemove = async () => {
    try {
      setAutoRemoving(true);
      const response = await triggerAutoRemoval();
      if (response.success) {
        alert(`✅ ${response.message}`);
        await fetchRemovalScores();
      } else {
        alert(`⚠️ ${response.message}`);
      }
    } catch (err: any) {
      console.error('Error triggering auto-removal:', err);
      alert(`❌ Error: ${err.response?.data?.message || 'Failed to trigger auto-removal'}`);
    } finally {
      setAutoRemoving(false);
    }
  };

  const handleRemoveTopN = async () => {
    if (removeCount <= 0) {
      alert('⚠️ Please enter a valid number greater than 0');
      return;
    }
    
    if (removeCount > usersWithScores.length) {
      alert(`⚠️ Cannot remove ${removeCount} users. Only ${usersWithScores.length} active users available.`);
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove the top ${removeCount} user(s) with highest removal scores?`
    );
    
    if (!confirmed) return;

    try {
      setRemovingTopN(true);
      const response = await removeTopNUsers(removeCount);
      if (response.success) {
        const removedNames = response.removedUsers.map(u => u.userName).join(', ');
        alert(`✅ ${response.message}\nRemoved: ${removedNames}`);
        await fetchRemovalScores();
      } else {
        alert(`⚠️ ${response.message}`);
      }
    } catch (err: any) {
      console.error('Error removing top N users:', err);
      alert(`❌ Error: ${err.response?.data?.message || 'Failed to remove users'}`);
    } finally {
      setRemovingTopN(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.7) return 'text-red-600 bg-red-50';
    if (score >= 0.5) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 0.7) return 'bg-red-500';
    if (score >= 0.5) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const formatDuration = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading && usersWithScores.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading removal scores...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Removal Scores Management</h1>
                <p className="text-gray-600">Welcome back, {user?.firstName}!</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="btn-secondary"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-gray-600">
            Monitor and manage automatic user removal when capacity is full. 
            Higher scores indicate users more likely to be removed first.
          </p>
        </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex gap-4 flex-wrap items-end">
        <button
          onClick={fetchRemovalScores}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
        
        <button
          onClick={handleAutoRemove}
          disabled={autoRemoving || usersWithScores.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {autoRemoving ? 'Removing...' : '⚡ Auto-Remove Highest Score'}
        </button>
        
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max={usersWithScores.length}
            value={removeCount}
            onChange={(e) => setRemoveCount(Math.max(1, Math.min(parseInt(e.target.value) || 1, usersWithScores.length)))}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Count"
          />
          <button
            onClick={handleRemoveTopN}
            disabled={removingTopN || usersWithScores.length === 0 || removeCount <= 0}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {removingTopN ? 'Removing...' : `🗑️ Remove Top ${removeCount}`}
          </button>
        </div>
        
        <div className="ml-auto text-sm text-gray-600 flex items-center">
          Total Active Users: <span className="ml-2 font-bold text-gray-800">{usersWithScores.length}</span>
        </div>
      </div>

      {usersWithScores.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No active users found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Top 5 Contenders {usersWithScores.length > 5 && `(of ${usersWithScores.length} total)`}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Removal Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Metrics
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Info
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersWithScores.slice(0, 5).map((userData, index) => (
                  <tr key={userData.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {userData.user.firstName} {userData.user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{userData.user.email}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(userData.removalScore)}`}>
                          {(userData.removalScore * 100).toFixed(1)}%
                        </span>
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getScoreBadgeColor(userData.removalScore)}`}
                            style={{ width: `${userData.removalScore * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        <div>⏱️ Spent: <span className="font-medium">{formatDuration(userData.metrics.timeSpent)}</span></div>
                        <div>⏰ Remaining: <span className="font-medium">{formatDuration(userData.metrics.remainingSlotTime)}</span></div>
                        <div>🧍 Entry Order: <span className="font-medium">#{userData.metrics.entryOrder}/{userData.metrics.totalUsers}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {userData.user.age && (
                          <div>🎂 Age: <span className="font-medium">{userData.user.age}</span></div>
                        )}
                        {userData.user.gender && (
                          <div>🚻 Gender: <span className="font-medium">{userData.user.gender}</span></div>
                        )}
                        <div>💎 Premium: <span className="font-medium">{userData.user.premiumUser ? 'Yes' : 'No'}</span></div>
                        <div>🙋 Cooperativeness: <span className="font-medium">{(userData.metrics.voluntaryExitScore * 100).toFixed(0)}%</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        <div>🕒 Entry: <span className="font-medium text-xs">{formatDate(userData.entryTime)}</span></div>
                        <div>🧭 Last Active: <span className="font-medium text-xs">{formatDate(userData.metrics.lastActive)}</span></div>
                        <div>🔁 Frequency: <span className="font-medium">{userData.metrics.frequencyUsed}/month</span></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">📊 Score Calculation Factors</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm text-blue-800">
          <div>🕒 Time Spent (20%)</div>
          <div>⏰ Remaining Slot (10%)</div>
          <div>🧍 Entry Order (10%)</div>
          <div>🧭 Last Active (8%)</div>
          <div>🔁 Frequency (8%)</div>
          <div>💎 Premium User (8%)</div>
          <div>🎂 Age (5%)</div>
          <div>🚻 Gender (4%)</div>
          <div>🙋 Cooperativeness (12%)</div>
          <div>🕓 Time of Day (15%)</div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default RemovalScoresManagement;

