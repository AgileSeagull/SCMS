/**
 * Holt-Winters Exponential Smoothing Model for Crowd Occupancy Prediction
 * 
 * Implements an additive Holt-Winters model with:
 * - Level: Baseline occupancy
 * - Trend: Growth/shrinkage pattern
 * - Seasonality: Repeating patterns (e.g., peak hours)
 * - Exogenous regressor: netRate (entry - exit rate)
 */

interface ForecastObservation {
  timestamp: Date;
  occupancy: number;
  entryRate: number;
  exitRate: number;
  netRate: number;
}

interface ForecastResult {
  timestamp: Date;
  forecastedOccupancy: number;
  confidence?: number;
}

interface CrowdStatus {
  status: 'NORMAL' | 'ALMOST_FULL' | 'FULL';
  percentage: number;
  message: string;
}

export class CrowdForecaster {
  // Smoothing parameters
  private alpha: number; // Level smoothing factor
  private gamma: number; // Trend smoothing factor
  private delta: number; // Seasonality smoothing factor
  private eta: number;   // Beta (exogenous regressor) learning rate

  // Model state
  private level: number = 0;
  private trend: number = 0;
  private seasonality: number[] = []; // Seasonal components
  private beta: number = 0.1; // Weight for netRate regressor

  // Configuration
  private seasonLength: number; // Seasonality period (e.g., 60 for hourly patterns)
  private maxCapacity: number;
  private observations: ForecastObservation[] = [];
  private maxObservations: number = 500; // Keep last N observations for outlier detection

  // Statistics for outlier detection
  private meanOccupancy: number = 0;
  private stdOccupancy: number = 0;

  constructor(config: {
    alpha?: number;
    gamma?: number;
    delta?: number;
    eta?: number;
    seasonLength?: number;
    maxCapacity: number;
    initialLevel?: number;
    initialTrend?: number;
  }) {
    this.alpha = config.alpha ?? 0.3;
    this.gamma = config.gamma ?? 0.1;
    this.delta = config.delta ?? 0.3;
    this.eta = config.eta ?? 0.01;
    this.seasonLength = config.seasonLength ?? 60; // 60 minutes = 1 hour cycle
    this.maxCapacity = config.maxCapacity;
    this.level = config.initialLevel ?? 0;
    this.trend = config.initialTrend ?? 0;
    
    // Initialize seasonality array
    this.seasonality = new Array(this.seasonLength).fill(0);
  }

  /**
   * Update model with new observation
   */
  update(observation: ForecastObservation): void {
    const { occupancy, netRate } = observation;

    // Outlier detection using 3σ rule
    const clippedOccupancy = this.clipOutlier(occupancy);

    // Calculate season index (current minute in season cycle)
    const seasonIndex = this.getSeasonIndex(observation.timestamp);
    const prevSeasonValue = this.seasonality[seasonIndex];

    // Store previous level before updating (for trend calculation)
    const prevLevelForTrend = this.level;

    // Prediction error (using previous state)
    const predicted = this.level + this.trend + prevSeasonValue + this.beta * netRate;
    const error = clippedOccupancy - predicted;

    // Update level first
    // level_t = α * (y_t - season_{t-s} - β*netRate_t) + (1-α) * (level_{t-1} + trend_{t-1})
    this.level = this.alpha * (clippedOccupancy - prevSeasonValue - this.beta * netRate) +
                 (1 - this.alpha) * (this.level + this.trend);

    // Update trend: trend_t = γ * (level_t - level_{t-1}) + (1-γ) * trend_{t-1}
    const levelDiff = this.level - prevLevelForTrend;
    this.trend = this.gamma * levelDiff + (1 - this.gamma) * this.trend;

    // Update seasonality
    this.seasonality[seasonIndex] = this.delta * (clippedOccupancy - this.level - this.beta * netRate) +
                                    (1 - this.delta) * prevSeasonValue;

    // Update beta (exogenous regressor weight) using gradient descent
    this.beta = this.beta + this.eta * error * netRate;
    this.beta = Math.max(0, Math.min(1, this.beta)); // Clamp beta between 0 and 1

    // Update statistics for outlier detection
    this.observations.push(observation);
    if (this.observations.length > this.maxObservations) {
      this.observations.shift();
    }
    this.updateStatistics();

    // Store observation
  }

  /**
   * Get season index based on timestamp
   */
  private getSeasonIndex(timestamp: Date): number {
    // Use minute of the hour as season index (0-59)
    // This captures hourly patterns
    const minutes = timestamp.getMinutes();
    return minutes % this.seasonLength;
  }

  /**
   * Clip outliers using 3σ rule
   */
  private clipOutlier(value: number): number {
    if (this.stdOccupancy === 0 || this.observations.length < 10) {
      return Math.max(0, Math.min(this.maxCapacity, value));
    }

    const lowerBound = this.meanOccupancy - 3 * this.stdOccupancy;
    const upperBound = this.meanOccupancy + 3 * this.stdOccupancy;

    return Math.max(
      Math.max(0, lowerBound),
      Math.min(this.maxCapacity, Math.min(upperBound, value))
    );
  }

  /**
   * Update mean and standard deviation for outlier detection
   */
  private updateStatistics(): void {
    if (this.observations.length === 0) return;

    const occupancies = this.observations.map(o => o.occupancy);
    this.meanOccupancy = occupancies.reduce((a, b) => a + b, 0) / occupancies.length;

    const variance = occupancies.reduce((sum, val) => {
      return sum + Math.pow(val - this.meanOccupancy, 2);
    }, 0) / occupancies.length;
    
    this.stdOccupancy = Math.sqrt(variance);
  }

  /**
   * Forecast occupancy for next k time steps
   */
  forecast(k: number): ForecastResult[] {
    const forecasts: ForecastResult[] = [];
    const now = new Date();

    for (let i = 1; i <= k; i++) {
      const futureTime = new Date(now.getTime() + i * 60 * 1000); // Each step is 1 minute
      const seasonIndex = this.getSeasonIndex(futureTime);

      // For forecast, we assume netRate remains constant at last observed value
      // In practice, you might want to use an average or trend of netRate
      const lastNetRate = this.observations.length > 0 
        ? this.observations[this.observations.length - 1].netRate 
        : 0;

      // Forecast equation: ŷ_t = level_(t-1) + trend_(t-1) + season_(t-s) + β * netRate_t
      const forecasted = this.level + this.trend * i + this.seasonality[seasonIndex] + this.beta * lastNetRate;

      // Clamp between 0 and maxCapacity
      const clampedForecast = Math.max(0, Math.min(this.maxCapacity, forecasted));

      forecasts.push({
        timestamp: futureTime,
        forecastedOccupancy: Math.round(clampedForecast),
        confidence: this.calculateConfidence(i)
      });
    }

    return forecasts;
  }

  /**
   * Forecast occupancy for next X minutes
   */
  forecastMinutes(minutesAhead: number): ForecastResult[] {
    return this.forecast(minutesAhead);
  }

  /**
   * Calculate confidence for forecast (decreases with time horizon)
   */
  private calculateConfidence(stepAhead: number): number {
    // Confidence decreases exponentially with prediction horizon
    return Math.max(0.1, Math.exp(-stepAhead / 30)); // 50% confidence at ~30 minutes
  }

  /**
   * Get current crowd status based on forecast
   */
  getCrowdStatus(forecastedOccupancy: number): CrowdStatus {
    const percentage = (forecastedOccupancy / this.maxCapacity) * 100;

    if (percentage >= 100) {
      return {
        status: 'FULL',
        percentage,
        message: 'Library is at full capacity'
      };
    } else if (percentage >= 90) {
      return {
        status: 'ALMOST_FULL',
        percentage,
        message: 'Library is almost full'
      };
    } else {
      return {
        status: 'NORMAL',
        percentage,
        message: 'Library has normal occupancy'
      };
    }
  }

  /**
   * Get model state for debugging/monitoring
   */
  getState(): {
    level: number;
    trend: number;
    beta: number;
    seasonality: number[];
    meanOccupancy: number;
    stdOccupancy: number;
  } {
    return {
      level: this.level,
      trend: this.trend,
      beta: this.beta,
      seasonality: [...this.seasonality],
      meanOccupancy: this.meanOccupancy,
      stdOccupancy: this.stdOccupancy
    };
  }

  /**
   * Reset model state
   */
  reset(): void {
    this.level = 0;
    this.trend = 0;
    this.seasonality = new Array(this.seasonLength).fill(0);
    this.beta = 0.1;
    this.observations = [];
    this.meanOccupancy = 0;
    this.stdOccupancy = 0;
  }

  /**
   * Set max capacity (in case it changes)
   */
  setMaxCapacity(maxCapacity: number): void {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Initialize model with historical data
   */
  initialize(historicalData: ForecastObservation[]): void {
    if (historicalData.length === 0) return;

    // Calculate initial level as mean of first few observations
    const initialObservations = historicalData.slice(0, Math.min(10, historicalData.length));
    this.level = initialObservations.reduce((sum, obs) => sum + obs.occupancy, 0) / initialObservations.length;

    // Calculate initial trend
    if (historicalData.length >= 2) {
      const first = historicalData[0].occupancy;
      const last = historicalData[historicalData.length - 1].occupancy;
      this.trend = (last - first) / historicalData.length;
    }

    // Initialize seasonality by averaging values at each season position
    const seasonMap = new Map<number, number[]>();
    historicalData.forEach(obs => {
      const idx = this.getSeasonIndex(obs.timestamp);
      if (!seasonMap.has(idx)) {
        seasonMap.set(idx, []);
      }
      seasonMap.get(idx)!.push(obs.occupancy - this.level);
    });

    for (let i = 0; i < this.seasonLength; i++) {
      const values = seasonMap.get(i) || [];
      this.seasonality[i] = values.length > 0 
        ? values.reduce((a, b) => a + b, 0) / values.length 
        : 0;
    }

    // Update model with all historical data
    historicalData.forEach(obs => this.update(obs));
  }
}

// Singleton instance for the application
let forecasterInstance: CrowdForecaster | null = null;

/**
 * Get or create the global forecaster instance
 */
export function getForecaster(maxCapacity: number = 100): CrowdForecaster {
  if (!forecasterInstance) {
    forecasterInstance = new CrowdForecaster({
      maxCapacity,
      alpha: 0.3,
      gamma: 0.1,
      delta: 0.3,
      eta: 0.01,
      seasonLength: 60 // 60-minute seasonal cycle
    });
  }
  return forecasterInstance;
}

/**
 * Reset the global forecaster instance
 */
export function resetForecaster(): void {
  if (forecasterInstance) {
    forecasterInstance.reset();
  }
}

