import React, { useState, useCallback } from 'react';
import { HintAnalysis, Coordinate } from '../types/index';
import './HintOverlay.css';

/**
 * Display mode for hint overlay
 */
export enum HintDisplayMode {
  MINIMAL = 'minimal',
  DETAILED = 'detailed',
  PROBABILITIES = 'probabilities',
  RECOMMENDATIONS = 'recommendations'
}

/**
 * Props for HintOverlay component
 */
interface HintOverlayProps {
  hint: HintAnalysis | null;
  isVisible: boolean;
  displayMode: HintDisplayMode;
  onDisplayModeChange: (mode: HintDisplayMode) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Props for individual hint section components
 */
interface HintSectionProps {
  title: string;
  children: React.ReactNode;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Collapsible section component for organizing hint information
 */
const HintSection: React.FC<HintSectionProps> = ({
  title,
  children,
  isCollapsible = false,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    if (isCollapsible) {
      setIsExpanded(!isExpanded);
    }
  }, [isCollapsible, isExpanded]);

  return (
    <div className="hint-section">
      <div 
        className={`hint-section-header ${isCollapsible ? 'collapsible' : ''}`}
        onClick={toggleExpanded}
        role={isCollapsible ? 'button' : undefined}
        tabIndex={isCollapsible ? 0 : undefined}
        onKeyDown={(e) => {
          if (isCollapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <h4>{title}</h4>
        {isCollapsible && (
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        )}
      </div>
      {(!isCollapsible || isExpanded) && (
        <div className="hint-section-content">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Component for displaying coordinate information
 */
interface CoordinateListProps {
  coordinates: Coordinate[];
  label: string;
  className?: string;
}

const CoordinateList: React.FC<CoordinateListProps> = ({
  coordinates,
  label,
  className = ''
}) => {
  if (coordinates.length === 0) {
    return <p className="no-items">No {label.toLowerCase()} found</p>;
  }

  return (
    <div className={`coordinate-list ${className}`}>
      <p className="coordinate-count">
        {coordinates.length} {label.toLowerCase()}{coordinates.length !== 1 ? 's' : ''}:
      </p>
      <ul className="coordinates">
        {coordinates.map((coord, index) => (
          <li key={index} className="coordinate-item">
            ({coord.x}, {coord.y})
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Component for displaying probability information
 */
interface ProbabilityListProps {
  probabilities: Map<Coordinate, number>;
  maxItems?: number;
}

const ProbabilityList: React.FC<ProbabilityListProps> = ({
  probabilities,
  maxItems = 10
}) => {
  if (probabilities.size === 0) {
    return <p className="no-items">No probability data available</p>;
  }

  // Sort probabilities by value (lowest risk first)
  const sortedProbabilities = Array.from(probabilities.entries())
    .sort(([, a], [, b]) => a - b)
    .slice(0, maxItems);

  return (
    <div className="probability-list">
      <p className="probability-count">
        Showing {sortedProbabilities.length} of {probabilities.size} cells:
      </p>
      <ul className="probabilities">
        {sortedProbabilities.map(([coord, probability], index) => (
          <li key={index} className="probability-item">
            <span className="coordinate">({coord.x}, {coord.y})</span>
            <span className={`probability ${getProbabilityClass(probability)}`}>
              {Math.round(probability * 100)}%
            </span>
            <span className="risk-level">{getRiskLevel(probability)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Get CSS class for probability value
 */
const getProbabilityClass = (probability: number): string => {
  if (probability < 0.2) return 'very-low';
  if (probability < 0.4) return 'low';
  if (probability < 0.6) return 'medium';
  if (probability < 0.8) return 'high';
  return 'very-high';
};

/**
 * Get human-readable risk level
 */
const getRiskLevel = (probability: number): string => {
  if (probability < 0.1) return 'Very Safe';
  if (probability < 0.3) return 'Safe';
  if (probability < 0.5) return 'Moderate';
  if (probability < 0.7) return 'Risky';
  return 'Very Risky';
};

/**
 * Get confidence level description
 */
const getConfidenceDescription = (confidence: number): string => {
  if (confidence >= 0.8) return 'Very High';
  if (confidence >= 0.6) return 'High';
  if (confidence >= 0.4) return 'Medium';
  if (confidence >= 0.2) return 'Low';
  return 'Very Low';
};

/**
 * Get confidence level CSS class
 */
const getConfidenceClass = (confidence: number): string => {
  if (confidence >= 0.8) return 'very-high';
  if (confidence >= 0.6) return 'high';
  if (confidence >= 0.4) return 'medium';
  if (confidence >= 0.2) return 'low';
  return 'very-low';
};

/**
 * HintOverlay component displays AI assistance information
 * Requirements: 2.2, 2.5, 4.5
 */
export const HintOverlay: React.FC<HintOverlayProps> = ({
  hint,
  isVisible,
  displayMode,
  onDisplayModeChange,
  onClose,
  className = ''
}) => {
  const handleModeChange = useCallback((mode: HintDisplayMode) => {
    onDisplayModeChange(mode);
  }, [onDisplayModeChange]);

  if (!isVisible || !hint) {
    return null;
  }

  const renderMinimalMode = () => (
    <div className="hint-minimal">
      <HintSection title="Quick Recommendation">
        {hint.recommendedMove ? (
          <div className="recommendation">
            <p className="recommended-move">
              Try cell ({hint.recommendedMove.x}, {hint.recommendedMove.y})
            </p>
            <p className={`confidence ${getConfidenceClass(hint.confidence)}`}>
              Confidence: {getConfidenceDescription(hint.confidence)}
            </p>
          </div>
        ) : (
          <p className="no-recommendation">No clear recommendation available</p>
        )}
      </HintSection>
    </div>
  );

  const renderDetailedMode = () => (
    <div className="hint-detailed">
      <HintSection title="Guaranteed Moves">
        <CoordinateList 
          coordinates={hint.guaranteedSafe} 
          label="Safe cells"
          className="safe-cells"
        />
        <CoordinateList 
          coordinates={hint.guaranteedMines} 
          label="Mine cells"
          className="mine-cells"
        />
      </HintSection>

      <HintSection title="Recommendation" isCollapsible defaultExpanded>
        {hint.recommendedMove ? (
          <div className="recommendation">
            <p className="recommended-move">
              Recommended: ({hint.recommendedMove.x}, {hint.recommendedMove.y})
            </p>
            <p className={`confidence ${getConfidenceClass(hint.confidence)}`}>
              Confidence: {getConfidenceDescription(hint.confidence)} ({Math.round(hint.confidence * 100)}%)
            </p>
          </div>
        ) : (
          <p className="no-recommendation">No clear recommendation available</p>
        )}
      </HintSection>
    </div>
  );

  const renderProbabilitiesMode = () => (
    <div className="hint-probabilities">
      <HintSection title="Mine Probabilities">
        <ProbabilityList probabilities={hint.probabilities} />
      </HintSection>
      
      {(hint.guaranteedSafe.length > 0 || hint.guaranteedMines.length > 0) && (
        <HintSection title="Guaranteed Moves" isCollapsible>
          <CoordinateList 
            coordinates={hint.guaranteedSafe} 
            label="Safe cells"
            className="safe-cells"
          />
          <CoordinateList 
            coordinates={hint.guaranteedMines} 
            label="Mine cells"
            className="mine-cells"
          />
        </HintSection>
      )}
    </div>
  );

  const renderRecommendationsMode = () => (
    <div className="hint-recommendations">
      <HintSection title="Best Move">
        {hint.recommendedMove ? (
          <div className="recommendation primary">
            <p className="recommended-move">
              Best choice: ({hint.recommendedMove.x}, {hint.recommendedMove.y})
            </p>
            <p className={`confidence ${getConfidenceClass(hint.confidence)}`}>
              Confidence: {getConfidenceDescription(hint.confidence)}
            </p>
          </div>
        ) : (
          <p className="no-recommendation">No clear recommendation available</p>
        )}
      </HintSection>

      <HintSection title="Alternative Options" isCollapsible>
        <ProbabilityList probabilities={hint.probabilities} maxItems={5} />
      </HintSection>

      <HintSection title="Analysis Summary" isCollapsible>
        <div className="analysis-summary">
          <p>Safe moves: {hint.guaranteedSafe.length}</p>
          <p>Known mines: {hint.guaranteedMines.length}</p>
          <p>Uncertain cells: {hint.probabilities.size}</p>
          <p className={`confidence ${getConfidenceClass(hint.confidence)}`}>
            Overall confidence: {Math.round(hint.confidence * 100)}%
          </p>
        </div>
      </HintSection>
    </div>
  );

  const renderContent = () => {
    switch (displayMode) {
      case HintDisplayMode.MINIMAL:
        return renderMinimalMode();
      case HintDisplayMode.DETAILED:
        return renderDetailedMode();
      case HintDisplayMode.PROBABILITIES:
        return renderProbabilitiesMode();
      case HintDisplayMode.RECOMMENDATIONS:
        return renderRecommendationsMode();
      default:
        return renderMinimalMode();
    }
  };

  return (
    <div className={`hint-overlay ${className}`} role="dialog" aria-label="AI Hint Information">
      <div className="hint-header">
        <h3>AI Assistant</h3>
        <div className="hint-controls">
          <select 
            value={displayMode} 
            onChange={(e) => handleModeChange(e.target.value as HintDisplayMode)}
            className="mode-selector"
            aria-label="Hint display mode"
          >
            <option value={HintDisplayMode.MINIMAL}>Quick</option>
            <option value={HintDisplayMode.DETAILED}>Detailed</option>
            <option value={HintDisplayMode.PROBABILITIES}>Probabilities</option>
            <option value={HintDisplayMode.RECOMMENDATIONS}>Recommendations</option>
          </select>
          <button 
            onClick={onClose}
            className="close-button"
            aria-label="Close hint overlay"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="hint-content">
        {renderContent()}
      </div>

      <div className="hint-footer">
        <p className="hint-disclaimer">
          AI suggestions are based on probability analysis and may not guarantee success.
        </p>
      </div>
    </div>
  );
};

export default HintOverlay;