import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { analyticsService, AnalyticsData, RealTimeAnalytics } from '../../services/analyticsService';
import { logsService, LogEntry, LogsFilters, LogStatistics } from '../../services/logsService';
import { getForecast as fetchForecast, initializeForecaster, ForecastResponse } from '../../services/forecastService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Tab Component
const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
      active
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {children}
  </button>
);

// Analytics Tab Content
const AnalyticsTab: React.FC<{
  analytics: AnalyticsData | null;
  realTimeData: RealTimeAnalytics | null;
  isConnected: boolean;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
}> = ({ analytics, realTimeData, isConnected, selectedPeriod, setSelectedPeriod }) => {
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastMinutes, setForecastMinutes] = useState(30);
  const formatPeriod = (period: string) => {
    switch (period) {
      case '1d': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      default: return 'Last 7 Days';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const loadForecast = async () => {
    try {
      setForecastLoading(true);
      const data = await fetchForecast(forecastMinutes);
      setForecastData(data);
    } catch (error) {
      console.error('Error fetching forecast:', error);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
    // Refresh forecast every 30 seconds
    const interval = setInterval(loadForecast, 30000);
    return () => clearInterval(interval);
  }, [forecastMinutes]);

  // Initialize forecaster on first load
  useEffect(() => {
    initializeForecaster().catch(console.error);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FULL': return 'text-red-600 bg-red-50';
      case 'ALMOST_FULL': return 'text-orange-600 bg-orange-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  return (
    <div>
      {/* Header Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Real-time Summary Cards */}
      {realTimeData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today's Entries</p>
                <p className="text-2xl font-semibold text-gray-900">{realTimeData.todayEntries}</p>
                <p className="text-sm text-gray-500">{realTimeData.todayExits} exits</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Current Occupancy</p>
                <p className="text-2xl font-semibold text-gray-900">{realTimeData.currentOccupancy}</p>
                <p className="text-sm text-gray-500">{realTimeData.occupancyRate}% capacity</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Activity</p>
                <p className="text-2xl font-semibold text-gray-900">{analytics?.summary.totalLogs || 0}</p>
                <p className="text-sm text-gray-500">{formatPeriod(selectedPeriod)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Last Updated</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatTime(realTimeData.timestamp)}
                </p>
                <p className="text-sm text-gray-500">Real-time</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Daily Activity Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Daily Activity</h3>
              <span className="text-sm text-gray-500">{formatPeriod(selectedPeriod)}</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.dailyData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  stroke="#888"
                />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="entries" 
                  stroke="#3b82f6" 
                  name="Entries"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="exits" 
                  stroke="#ef4444" 
                  name="Exits"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Peak Hours Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Peak Hours</h3>
              <span className="text-xs text-gray-500">
                Avg: {analytics.peakHours.averageHourlyActivity} events/hr
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart 
                data={analytics.peakHours.peakHours.slice(0, 10).map(h => ({
                  hour: `${h.hour}:00`,
                  activities: h.count
                }))}
                margin={{ top: 20, right: 30, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="hour" 
                  stroke="#888"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => [`${value} activities`, 'Activities']}
                />
                <Line 
                  type="monotone" 
                  dataKey="activities" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  name="Activities"
                  dot={false}
                  activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Occupancy Forecast */}
      {forecastData && (
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Occupancy Forecast</h3>
                <p className="text-sm text-gray-500">Predictive analytics using Holt-Winters Exponential Smoothing</p>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={forecastMinutes}
                  onChange={(e) => setForecastMinutes(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value={10}>10 minutes</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
                <button
                  onClick={loadForecast}
                  disabled={forecastLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {forecastLoading ? 'Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            {/* Forecast Status Card */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current Occupancy</p>
                  <p className="text-lg font-bold text-gray-900">{forecastData.currentOccupancy}/{forecastData.maxCapacity}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Net Rate</p>
                  <p className={`text-lg font-bold ${forecastData.netRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {forecastData.netRate >= 0 ? '+' : ''}{forecastData.netRate.toFixed(2)}/min
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Forecasted (30min)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {forecastData.forecasts.length > 0 ? forecastData.forecasts[29]?.forecastedOccupancy || forecastData.forecasts[forecastData.forecasts.length - 1].forecastedOccupancy : 'N/A'}/
                    {forecastData.maxCapacity}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(forecastData.crowdStatus.status)}`}>
                    {forecastData.crowdStatus.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Forecast Chart */}
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={[
                // Historical occupancy data (for blue "Current" line)
                ...(forecastData.historicalOccupancy || []).map((h) => ({
                  time: new Date(h.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  occupancy: h.occupancy,
                  forecast: null,
                  type: 'historical'
                })),
                // Current point (transition from historical to forecast)
                { 
                  time: 'Now', 
                  occupancy: forecastData.currentOccupancy,
                  forecast: forecastData.currentOccupancy,
                  type: 'current'
                },
                // Forecast data (for green "Forecast" line)
                ...forecastData.forecasts.map((f) => ({
                  time: new Date(f.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  occupancy: null,
                  forecast: f.forecastedOccupancy,
                  confidence: f.confidence,
                  type: 'forecast'
                }))
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  stroke="#888"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tickFormatter={(value, index) => {
                    if (!forecastData) return '';
                    
                    // Calculate indices
                    const historicalCount = forecastData.historicalOccupancy?.length || 0;
                    const forecastCount = forecastData.forecasts.length;
                    const totalPoints = historicalCount + 1 + forecastCount;
                    const nowIndex = historicalCount;
                    
                    // Always show first point, "Now", and last point
                    if (index === 0 || index === nowIndex || index === totalPoints - 1) {
                      return value;
                    }
                    
                    // For forecast points (after "Now"), show every 5th point (5-minute intervals)
                    if (index > nowIndex) {
                      const forecastIndex = index - nowIndex - 1;
                      if (forecastIndex % 5 !== 0) return '';
                    } else {
                      // For historical points (before "Now"), show every 5th point
                      if (index % 5 !== 0) return '';
                    }
                    
                    return value;
                  }}
                />
                <YAxis 
                  stroke="#888"
                  label={{ value: 'Occupancy', angle: -90, position: 'insideLeft' }}
                  domain={[0, forecastData.maxCapacity]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value: any, name: string, props: any) => {
                    if (name === 'forecast' && props.payload.confidence) {
                      return [`${value} (confidence: ${(props.payload.confidence * 100).toFixed(0)}%)`, 'Forecast'];
                    }
                    return [value, name === 'occupancy' ? 'Current' : 'Forecast'];
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="occupancy" 
                  stroke="#3b82f6" 
                  name="Current"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  strokeDasharray="5 5"
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="forecast" 
                  stroke="#10b981" 
                  name="Forecast"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Model State Info */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800 mb-2">Model State:</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-medium">Level:</span> {forecastData.modelState.level.toFixed(1)}
                </div>
                <div>
                  <span className="font-medium">Trend:</span> {forecastData.modelState.trend >= 0 ? '+' : ''}{forecastData.modelState.trend.toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">NetRate Weight (β):</span> {forecastData.modelState.beta.toFixed(3)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Active Users */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Active Users</h3>
            <div className="space-y-3">
              {analytics.userActivity.slice(0, 5).map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-sm font-medium text-purple-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.user?.firstName} {user.user?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{user.user?.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{user.activityCount}</p>
                    <p className="text-xs text-gray-500">activities</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          {realTimeData && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {realTimeData.recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-3 ${
                        activity.type === 'ENTRY' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {activity.type}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.user.firstName} {activity.user.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Library Status History */}
      {analytics && analytics.libraryStatusHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Library Status History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.libraryStatusHistory.slice(0, 10).map((status) => (
                  <tr key={status.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        status.status === 'OPEN' 
                          ? 'bg-green-100 text-green-800'
                          : status.status === 'CLOSED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {status.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {status.message || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(status.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Logs Tab Content
const LogsTab: React.FC<{
  logs: LogEntry[];
  statistics: LogStatistics | null;
  loading: boolean;
  pagination: any;
  filters: LogsFilters;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  handleFilterChange: (key: keyof LogsFilters, value: any) => void;
  handlePageChange: (page: number) => void;
  clearFilters: () => void;
  handleExport: () => void;
}> = ({ logs, statistics, loading, pagination, filters, showFilters, setShowFilters, handleFilterChange, handlePageChange, clearFilters, handleExport }) => {
  return (
    <div>
      {/* Header Controls */}
      <div className="mb-6 flex items-center justify-end space-x-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
          </svg>
          <span className="ml-2">{showFilters ? 'Hide' : 'Show'} Filters</span>
        </button>
        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="ml-2">Export CSV</span>
        </button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Logs</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.totalLogs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xs font-bold">E</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Entries</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.entryCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xs font-bold">X</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Exits</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.exitCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-xs font-bold">U</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Unique Users</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.uniqueUsers}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search by Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={filters.userName || ''}
                  onChange={(e) => handleFilterChange('userName', e.target.value)}
                  placeholder="Search by name or email"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Access Logs ({pagination.totalCount} total)
          </h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <svg className="h-12 w-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No logs found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or check back later.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.user.firstName} {log.user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{log.user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.type === 'ENTRY' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.user.role === 'ADMIN' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.user.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">
                        {((pagination.currentPage - 1) * pagination.limit) + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}
                      </span>{' '}
                      of{' '}
                      <span className="font-medium">{pagination.totalCount}</span>{' '}
                      results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={!pagination.hasPrevPage}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={!pagination.hasNextPage}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Main Component
const AnalyticsAndLogs: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected } = useSocket();
  
  // Determine initial tab based on URL
  const getInitialTab = (): 'analytics' | 'logs' => {
    if (location.pathname === '/admin/logs') {
      return 'logs';
    }
    return 'analytics';
  };
  
  const [activeTab, setActiveTab] = useState<'analytics' | 'logs'>(getInitialTab());
  
  // Update tab when URL changes
  useEffect(() => {
    if (location.pathname === '/admin/logs') {
      setActiveTab('logs');
    } else if (location.pathname === '/admin/analytics') {
      setActiveTab('analytics');
    }
  }, [location.pathname]);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [realTimeData, setRealTimeData] = useState<RealTimeAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statistics, setStatistics] = useState<LogStatistics | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 50
  });
  const [filters, setFilters] = useState<LogsFilters>({
    page: 1,
    limit: 50
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const [analyticsData, realTimeAnalytics] = await Promise.all([
        analyticsService.getAnalytics(selectedPeriod),
        analyticsService.getRealTimeAnalytics()
      ]);
      setAnalytics(analyticsData);
      setRealTimeData(realTimeAnalytics);
      setAnalyticsError(null);
    } catch (err: any) {
      setAnalyticsError(err.response?.data?.error || 'Failed to fetch analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await logsService.getEntryExitLogs(filters);
      setLogs(response.logs);
      setPagination(response.pagination);
      setLogsError(null);
    } catch (err: any) {
      setLogsError(err.response?.data?.error || 'Failed to fetch logs');
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const stats = await logsService.getLogStatistics(
        filters.startDate,
        filters.endDate
      );
      setStatistics(stats);
    } catch (err: any) {
      console.error('Failed to fetch statistics:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
      
      // Set up real-time updates every 30 seconds
      const interval = setInterval(() => {
        analyticsService.getRealTimeAnalytics()
          .then(setRealTimeData)
          .catch(console.error);
      }, 30000);

      return () => clearInterval(interval);
    } else {
      fetchLogs();
      fetchStatistics();
    }
  }, [activeTab === 'analytics' ? selectedPeriod : filters]);

  const handleFilterChange = (key: keyof LogsFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50
    });
  };

  const handleExport = async () => {
    try {
      const blob = await logsService.exportLogs(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `entry-exit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setLogsError(err.response?.data?.error || 'Failed to export logs');
    }
  };

  const isLoading = (activeTab === 'analytics' ? analyticsLoading : logsLoading) && 
                   (activeTab === 'analytics' ? !analytics : logs.length === 0);
  const error = activeTab === 'analytics' ? analyticsError : logsError;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading {activeTab === 'analytics' ? 'analytics' : 'logs'}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading {activeTab === 'analytics' ? 'Analytics' : 'Logs'}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => activeTab === 'analytics' ? fetchAnalytics() : fetchLogs()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
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
                <h1 className="text-2xl font-bold text-gray-900">Analytics & Logs</h1>
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
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex -mb-px">
            <TabButton 
              active={activeTab === 'analytics'} 
              onClick={() => {
                setActiveTab('analytics');
                navigate('/admin/analytics');
              }}
            >
              Analytics & Insights
            </TabButton>
            <TabButton 
              active={activeTab === 'logs'} 
              onClick={() => {
                setActiveTab('logs');
                navigate('/admin/logs');
              }}
            >
              Entry/Exit Logs
            </TabButton>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'analytics' ? (
          <AnalyticsTab
            analytics={analytics}
            realTimeData={realTimeData}
            isConnected={isConnected}
            selectedPeriod={selectedPeriod}
            setSelectedPeriod={setSelectedPeriod}
          />
        ) : (
          <LogsTab
            logs={logs}
            statistics={statistics}
            loading={logsLoading}
            pagination={pagination}
            filters={filters}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            handleFilterChange={handleFilterChange}
            handlePageChange={handlePageChange}
            clearFilters={clearFilters}
            handleExport={handleExport}
          />
        )}
      </div>
    </div>
  );
};

export default AnalyticsAndLogs;

