import React, { useCallback, useEffect, useState } from 'react';
import { Cell, ClickType, HintAnalysis } from '../types/index';
import './GameGrid.css';

/**
 * Props for GameGrid component
 */
interface GameGridProps {
  board: Cell[][];
  gameStatus: 'playing' | 'won' | 'lost';
  onCellClick: (x: number, y: number, clickType: ClickType) => void;
  hint?: HintAnalysis | null;
  showProbabilities?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Individual cell component for the game grid
 */
interface CellProps {
  cell: Cell;
  gameStatus: 'playing' | 'won' | 'lost';
  onClick: (clickType: ClickType) => void;
  hint?: HintAnalysis | null;
  showProbabilities?: boolean;
  disabled?: boolean;
}

const GameCell: React.FC<CellProps> = ({
  cell,
  gameStatus,
  onClick,
  hint,
  showProbabilities = false,
  disabled = false
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationType, setAnimationType] = useState<'reveal' | 'number' | 'cascade' | 'explosion' | null>(null);
  const [wasRevealed, setWasRevealed] = useState(cell.isRevealed);
  const [isExploding, setIsExploding] = useState(false);
  const [wasFlagged, setWasFlagged] = useState(cell.isFlagged);
  const [flagAnimationType, setFlagAnimationType] = useState<'appearing' | 'disappearing' | null>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled) return;

    event.preventDefault();
    
    let clickType: ClickType;
    switch (event.button) {
      case 0: // Left click
        clickType = ClickType.LEFT;
        break;
      case 1: // Middle click
        clickType = ClickType.MIDDLE;
        break;
      case 2: // Right click
        clickType = ClickType.RIGHT;
        break;
      default:
        return;
    }

    onClick(clickType);
  }, [disabled, onClick]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault(); // Prevent browser context menu
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return;

    event.preventDefault();
    
    // Implement long press for right-click functionality on mobile
    const touchStartTime = Date.now();
    const touch = event.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    
    const longPressTimer = setTimeout(() => {
      // Long press detected - treat as right click (flag)
      onClick(ClickType.RIGHT);
    }, 500); // 500ms for long press
    
    const handleTouchEnd = (endEvent: TouchEvent) => {
      clearTimeout(longPressTimer);
      const touchEndTime = Date.now();
      const endTouch = endEvent.changedTouches[0];
      const endX = endTouch.clientX;
      const endY = endTouch.clientY;
      
      // Check if it was a quick tap and didn't move much
      const timeDiff = touchEndTime - touchStartTime;
      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
      
      if (timeDiff < 500 && distance < 10) {
        // Quick tap - treat as left click
        onClick(ClickType.LEFT);
      }
      
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      const moveX = moveTouch.clientX;
      const moveY = moveTouch.clientY;
      const distance = Math.sqrt(Math.pow(moveX - startX, 2) + Math.pow(moveY - startY, 2));
      
      // If moved too much, cancel the long press
      if (distance > 10) {
        clearTimeout(longPressTimer);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      }
    };
    
    document.addEventListener('touchend', handleTouchEnd, { once: true });
    document.addEventListener('touchmove', handleTouchMove);
  }, [disabled, onClick]);

  // Get cell display content
  const getCellContent = (): string => {
    if (cell.isFlagged) {
      return '🚩';
    }
    
    if (!cell.isRevealed) {
      return '';
    }
    
    if (cell.hasMine) {
      return '💣';
    }
    
    if (cell.adjacentMines > 0) {
      return cell.adjacentMines.toString();
    }
    
    return '';
  };

  // Get cell CSS classes
  const getCellClasses = (): string => {
    const classes = ['game-cell'];
    
    if (cell.isRevealed) {
      classes.push('revealed');
      if (cell.hasMine) {
        classes.push('mine');
        if (gameStatus === 'lost' || isExploding) {
          classes.push('exploded');
        }
      } else if (cell.adjacentMines > 0) {
        classes.push(`number-${cell.adjacentMines}`);
      }
    } else {
      classes.push('unrevealed');
      if (cell.isFlagged) {
        classes.push('flagged');
      }
    }

    // Add hint-related classes
    if (hint && !cell.isRevealed) {
      const coord = cell.coordinates;
      
      // Check if this cell is guaranteed safe
      const isGuaranteedSafe = hint.guaranteedSafe.some(
        safe => safe.x === coord.x && safe.y === coord.y
      );
      
      // Check if this cell is guaranteed mine
      const isGuaranteedMine = hint.guaranteedMines.some(
        mine => mine.x === coord.x && mine.y === coord.y
      );
      
      // Check if this is the recommended move
      const isRecommended = hint.recommendedMove && 
        hint.recommendedMove.x === coord.x && hint.recommendedMove.y === coord.y;

      if (isGuaranteedSafe) {
        classes.push('hint-safe');
      } else if (isGuaranteedMine) {
        classes.push('hint-mine');
      } else if (isRecommended) {
        classes.push('hint-recommended');
      }

      // Add probability-based classes if showing probabilities
      if (showProbabilities && hint.probabilities.has(coord)) {
        const probability = hint.probabilities.get(coord)!;
        if (probability < 0.2) {
          classes.push('probability-very-low');
        } else if (probability < 0.4) {
          classes.push('probability-low');
        } else if (probability < 0.6) {
          classes.push('probability-medium');
        } else if (probability < 0.8) {
          classes.push('probability-high');
        } else {
          classes.push('probability-very-high');
        }
      }
    }

    if (isAnimating) {
      classes.push('animating');
      if (animationType === 'reveal') {
        classes.push('revealing');
      } else if (animationType === 'number') {
        classes.push('number-revealing');
      } else if (animationType === 'cascade') {
        classes.push('cascade-revealing');
      } else if (animationType === 'explosion') {
        classes.push('exploding');
      }
    }

    if (disabled) {
      classes.push('disabled');
    }

    // Add flag animation classes
    if (flagAnimationType === 'appearing') {
      classes.push('flag-appearing');
    } else if (flagAnimationType === 'disappearing') {
      classes.push('flag-disappearing');
    }

    return classes.join(' ');
  };

  // Get probability display for overlay
  const getProbabilityDisplay = (): { text: string; className: string } | null => {
    if (!showProbabilities || !hint || cell.isRevealed) {
      return null;
    }

    const coord = cell.coordinates;
    const probability = hint.probabilities.get(coord);
    
    if (probability !== undefined) {
      const percentage = Math.round(probability * 100);
      let className = 'probability-overlay';
      
      // Add color-coded class based on risk level
      if (probability < 0.2) {
        className += ' safe';
      } else if (probability < 0.4) {
        className += ' low-risk';
      } else if (probability < 0.6) {
        className += ' medium-risk';
      } else if (probability < 0.8) {
        className += ' high-risk';
      } else {
        className += ' danger';
      }
      
      return { text: `${percentage}%`, className };
    }

    return null;
  };

  // Trigger animation when cell is revealed
  useEffect(() => {
    if (cell.isRevealed && !wasRevealed) {
      setIsAnimating(true);
      
      // Determine animation type based on cell content
      if (cell.hasMine) {
        setAnimationType('explosion');
        setIsExploding(true);
      } else if (cell.adjacentMines > 0) {
        setAnimationType('number');
      } else {
        setAnimationType('cascade');
      }
      
      // Animation duration varies by type
      const duration = cell.hasMine ? 600 : 
                      cell.adjacentMines > 0 ? 500 : 200;
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setAnimationType(null);
        if (cell.hasMine) {
          setIsExploding(false);
        }
      }, duration);
      
      setWasRevealed(true);
      return () => clearTimeout(timer);
    }
  }, [cell.isRevealed, wasRevealed, cell.hasMine, cell.adjacentMines]);

  // Handle game over explosion effects
  useEffect(() => {
    if (gameStatus === 'lost' && cell.hasMine && cell.isRevealed) {
      setIsExploding(true);
      const timer = setTimeout(() => setIsExploding(false), 600);
      return () => clearTimeout(timer);
    }
  }, [gameStatus, cell.hasMine, cell.isRevealed]);

  // Handle flag animations
  useEffect(() => {
    if (cell.isFlagged !== wasFlagged && !cell.isRevealed) {
      if (cell.isFlagged) {
        // Flag was placed
        setFlagAnimationType('appearing');
        const timer = setTimeout(() => setFlagAnimationType(null), 300);
        return () => clearTimeout(timer);
      } else {
        // Flag was removed
        setFlagAnimationType('disappearing');
        const timer = setTimeout(() => setFlagAnimationType(null), 250);
        return () => clearTimeout(timer);
      }
    }
    setWasFlagged(cell.isFlagged);
  }, [cell.isFlagged, wasFlagged, cell.isRevealed]);

  const probabilityDisplay = getProbabilityDisplay();

  return (
    <button
      className={getCellClasses()}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      disabled={disabled}
      aria-label={`Cell at ${cell.coordinates.x}, ${cell.coordinates.y}`}
    >
      <span className="cell-content">{getCellContent()}</span>
      {probabilityDisplay && (
        <span className={probabilityDisplay.className}>{probabilityDisplay.text}</span>
      )}
    </button>
  );
};

/**
 * GameGrid component renders the interactive minesweeper board
 * Requirements: 1.1, 1.2, 1.3, 4.3, 6.2
 */
export const GameGrid: React.FC<GameGridProps> = ({
  board,
  gameStatus,
  onCellClick,
  hint,
  showProbabilities = false,
  disabled = false,
  className = ''
}) => {
  const handleCellClick = useCallback((x: number, y: number, clickType: ClickType) => {
    if (disabled || gameStatus !== 'playing') {
      return;
    }
    onCellClick(x, y, clickType);
  }, [disabled, gameStatus, onCellClick]);

  // Calculate grid dimensions for CSS
  const gridWidth = board[0]?.length || 0;
  const gridHeight = board.length;

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
    gridTemplateRows: `repeat(${gridHeight}, 1fr)`,
  };

  return (
    <div 
      className={`game-grid ${className}`}
      style={gridStyle}
      role="grid"
      aria-label="Minesweeper game board"
    >
      {board.map((row, y) =>
        row.map((cell, x) => (
          <GameCell
            key={`${x}-${y}`}
            cell={cell}
            gameStatus={gameStatus}
            onClick={(clickType) => handleCellClick(x, y, clickType)}
            hint={hint}
            showProbabilities={showProbabilities}
            disabled={disabled}
          />
        ))
      )}
    </div>
  );
};

export default GameGrid;