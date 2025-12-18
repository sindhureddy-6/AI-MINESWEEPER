import React, { useState, useMemo } from 'react';
import { PlayerPerformance, GameResult } from '../types/index.js';
import './StatisticsPanel.css';

/**
 * Props for StatisticsPanel component
 */
interface StatisticsPanelProps {
  performance: PlayerPerformance;
  gameHistory: GameResult[];
  isVisible: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * Props for individual statistic display components
 */
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

/**
 * Individual statistic card component
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  className = ''
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'neutral': return '➡️';
      default: return '';
    }
  };

  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-header">
        <h4 className="stat-title">{title}</h4>
        {trend && <span className={`trend-icon ${trend}`}>{getTrendIcon()}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );
};

/**
 * Props for achievement display
 */
interface AchievementProps {
  title: string;
  description: string;
  isUnlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

/**
 * Achievement display component
 */
const Achievement: React.FC<AchievementProps> = ({
  title,
  description,
  isUnlocked,
  progress = 0,
  maxProgress = 1
}) => {
  const progressPercentage = maxProgress > 0 ? (progress / maxProgress) * 100 : 0;

  return (
    <div className={`achievement ${isUnlocked ? 'unlocked' : 'locked'}`}>
      <div className="achievement-icon">
        {isUnlocked ? '🏆' : '🔒'}
      </div>
      <div className="achievement-content">
        <h5 className="achievement-title">{title}</h5>
        <p className="achievement-description">{description}</p>
        {!isUnlocked && maxProgress > 1 && (
          <div className="achievement-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="progress-text">{progress}/{maxProgress}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Props for trend chart component
 */
interface TrendChartProps {
  data: { label: string; value: number }[];
  title: string;
  valueFormatter?: (value: number) => string;
}

/**
 * Simple trend chart component
 */
const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title,
  valueFormatter = (v) => v.toString()
}) => {
  if (data.length === 0) {
    return (
      <div className="trend-chart">
        <h4 className="chart-title">{title}</h4>
        <p className="no-data">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  return (
    <div className="trend-chart">
      <h4 className="chart-title">{title}</h4>
      <div className="chart-container">
        <div className="chart-bars">
          {data.map((item, index) => {
            const height = ((item.value - minValue) / range) * 100;
            return (
              <div key={index} className="chart-bar-container">
                <div 
                  className="chart-bar"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${item.label}: ${valueFormatter(item.value)}`}
                />
                <span className="chart-label">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Format time duration in milliseconds to human readable string
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return '< 1s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format percentage with one decimal place
 */
const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

/**
 * StatisticsPanel component displays player performance metrics and achievements
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  performance,
  gameHistory,
  isVisible,
  onClose,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'achievements'>('overview');

  // Calculate derived statistics
  const stats = useMemo(() => {
    const recentGames = gameHistory.slice(-10);
    const recentWinRate = recentGames.length > 0 
      ? recentGames.filter(g => g.success).length / recentGames.length 
      : 0;

    // Calculate current streak
    let currentStreak = 0;
    if (gameHistory.length > 0) {
      const lastResult = gameHistory[gameHistory.length - 1].success;
      for (let i = gameHistory.length - 1; i >= 0; i--) {
        if (gameHistory[i].success === lastResult) {
          currentStreak++;
        } else {
          break;
        }
      }
      if (!lastResult) currentStreak = -currentStreak;
    }

    // Calculate best streak
    let bestStreak = 0;
    let tempStreak = 0;
    gameHistory.forEach(game => {
      if (game.success) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    // Calculate difficulty distribution
    const difficultyStats = gameHistory.reduce((acc, game) => {
      const diff = game.difficulty.name;
      acc[diff] = (acc[diff] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate trend data for charts
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const dailyStats = last7Days.map(date => {
      const dayGames = gameHistory.filter(game => 
        game.timestamp.toISOString().split('T')[0] === date
      );
      const wins = dayGames.filter(g => g.success).length;
      return {
        label: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
        value: dayGames.length > 0 ? wins / dayGames.length : 0
      };
    });

    return {
      recentWinRate,
      currentStreak,
      bestStreak,
      difficultyStats,
      dailyStats,
      totalPlayTime: gameHistory.reduce((sum, game) => sum + game.duration, 0),
      averageHints: performance.hintUsageRate,
      gamesThisWeek: gameHistory.filter(game => 
        Date.now() - game.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
      ).length
    };
  }, [performance, gameHistory]);

  // Calculate achievements
  const achievements = useMemo(() => [
    {
      title: 'First Victory',
      description: 'Win your first game',
      isUnlocked: performance.gamesPlayed > 0 && performance.winRate > 0,
      progress: performance.gamesPlayed > 0 && performance.winRate > 0 ? 1 : 0,
      maxProgress: 1
    },
    {
      title: 'Streak Master',
      description: 'Win 5 games in a row',
      isUnlocked: stats.bestStreak >= 5,
      progress: Math.min(stats.bestStreak, 5),
      maxProgress: 5
    },
    {
      title: 'Speed Demon',
      description: 'Complete a game in under 60 seconds',
      isUnlocked: gameHistory.some(game => game.success && game.duration < 60000),
      progress: gameHistory.some(game => game.success && game.duration < 60000) ? 1 : 0,
      maxProgress: 1
    },
    {
      title: 'No Hints Needed',
      description: 'Win a game without using any hints',
      isUnlocked: gameHistory.some(game => game.success && game.hintsUsed === 0),
      progress: gameHistory.some(game => game.success && game.hintsUsed === 0) ? 1 : 0,
      maxProgress: 1
    },
    {
      title: 'Dedicated Player',
      description: 'Play 100 games',
      isUnlocked: performance.gamesPlayed >= 100,
      progress: Math.min(performance.gamesPlayed, 100),
      maxProgress: 100
    },
    {
      title: 'Expert Level',
      description: 'Achieve 80% win rate over 20+ games',
      isUnlocked: performance.gamesPlayed >= 20 && performance.winRate >= 0.8,
      progress: performance.gamesPlayed >= 20 ? Math.min(performance.winRate * 100, 80) : 0,
      maxProgress: 80
    }
  ], [performance, gameHistory, stats.bestStreak]);

  if (!isVisible) {
    return null;
  }

  const renderOverviewTab = () => (
    <div className="stats-overview">
      <div className="stats-grid">
        <StatCard
          title="Games Played"
          value={performance.gamesPlayed}
          subtitle="Total sessions"
        />
        <StatCard
          title="Win Rate"
          value={formatPercentage(performance.winRate)}
          subtitle={`${Math.round(performance.winRate * performance.gamesPlayed)} wins`}
          trend={stats.recentWinRate > performance.winRate ? 'up' : 
                 stats.recentWinRate < performance.winRate ? 'down' : 'neutral'}
        />
        <StatCard
          title="Average Time"
          value={formatDuration(performance.averageTime)}
          subtitle="Per completed game"
        />
        <StatCard
          title="Current Streak"
          value={Math.abs(stats.currentStreak)}
          subtitle={stats.currentStreak >= 0 ? 'wins' : 'losses'}
          trend={stats.currentStreak > 0 ? 'up' : stats.currentStreak < 0 ? 'down' : 'neutral'}
        />
        <StatCard
          title="Best Streak"
          value={stats.bestStreak}
          subtitle="consecutive wins"
        />
        <StatCard
          title="Hints Per Game"
          value={stats.averageHints.toFixed(1)}
          subtitle="Average usage"
        />
      </div>

      <div className="difficulty-breakdown">
        <h4>Games by Difficulty</h4>
        <div className="difficulty-stats">
          {Object.entries(stats.difficultyStats).map(([difficulty, count]) => (
            <div key={difficulty} className="difficulty-stat">
              <span className="difficulty-name">{difficulty}</span>
              <span className="difficulty-count">{count} games</span>
              <div className="difficulty-bar">
                <div 
                  className="difficulty-fill"
                  style={{ width: `${(count / performance.gamesPlayed) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTrendsTab = () => (
    <div className="stats-trends">
      <TrendChart
        title="Win Rate (Last 7 Days)"
        data={stats.dailyStats}
        valueFormatter={formatPercentage}
      />
      
      <div className="trend-summary">
        <h4>Recent Performance</h4>
        <div className="trend-stats">
          <StatCard
            title="This Week"
            value={stats.gamesThisWeek}
            subtitle="games played"
          />
          <StatCard
            title="Recent Win Rate"
            value={formatPercentage(stats.recentWinRate)}
            subtitle="last 10 games"
            trend={stats.recentWinRate > performance.winRate ? 'up' : 
                   stats.recentWinRate < performance.winRate ? 'down' : 'neutral'}
          />
          <StatCard
            title="Total Play Time"
            value={formatDuration(stats.totalPlayTime)}
            subtitle="all sessions"
          />
        </div>
      </div>
    </div>
  );

  const renderAchievementsTab = () => (
    <div className="stats-achievements">
      <div className="achievements-summary">
        <h4>Progress Overview</h4>
        <p>
          {achievements.filter(a => a.isUnlocked).length} of {achievements.length} achievements unlocked
        </p>
      </div>
      
      <div className="achievements-list">
        {achievements.map((achievement, index) => (
          <Achievement
            key={index}
            title={achievement.title}
            description={achievement.description}
            isUnlocked={achievement.isUnlocked}
            progress={achievement.progress}
            maxProgress={achievement.maxProgress}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={`statistics-panel ${className}`} role="dialog" aria-label="Game Statistics">
      <div className="stats-header">
        <h3>Statistics</h3>
        <button 
          onClick={onClose}
          className="close-button"
          aria-label="Close statistics panel"
        >
          ✕
        </button>
      </div>

      <div className="stats-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Trends
        </button>
        <button
          className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements
        </button>
      </div>

      <div className="stats-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'trends' && renderTrendsTab()}
        {activeTab === 'achievements' && renderAchievementsTab()}
      </div>
    </div>
  );
};

export default StatisticsPanel;