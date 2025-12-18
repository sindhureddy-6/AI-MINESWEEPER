import { useState, useEffect, useCallback, useRef } from 'react';
import { GameController } from './controllers/GameController.js';
import { GameGrid } from './components/GameGrid.js';
import { HintOverlay, HintDisplayMode } from './components/HintOverlay.js';
import { StatisticsPanel } from './components/StatisticsPanel.js';
import { GameState, DifficultySettings, ClickType, HintAnalysis, GameResult, DifficultyLevel } from './types/index.js';
import { DIFFICULTY_PRESETS } from './utils/constants.js';
import './App.css';

/**
 * Main application component integrating all game systems
 * Requirements: All requirements
 */
function App() {
  // Game controller instance
  const gameControllerRef = useRef<GameController | null>(null);
  
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  
  // UI state
  const [currentHint, setCurrentHint] = useState<HintAnalysis | null>(null);
  const [isHintOverlayVisible, setIsHintOverlayVisible] = useState(false);
  const [hintDisplayMode, setHintDisplayMode] = useState<HintDisplayMode>(HintDisplayMode.MINIMAL);
  const [showProbabilities, setShowProbabilities] = useState(false);
  const [isStatsPanelVisible, setIsStatsPanelVisible] = useState(false);
  const [isGeneratingHint, setIsGeneratingHint] = useState(false);
  
  // Performance tracking
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [gameHistory, setGameHistory] = useState<GameResult[]>([]);
  
  // Settings
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultySettings>(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER]);
  const [isAdaptiveDifficultyEnabled, setIsAdaptiveDifficultyEnabled] = useState(true);
  
  // Error handling
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize game controller
  useEffect(() => {
    const initializeGame = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Create game controller with initial difficulty
        const controller = new GameController(selectedDifficulty);
        gameControllerRef.current = controller;
        
        // Set up event listeners
        controller.addEventListener('gameStateChanged', handleGameStateChange);
        controller.addEventListener('cellRevealed', handleCellRevealed);
        controller.addEventListener('cellFlagged', handleCellFlagged);
        controller.addEventListener('gameStarted', handleGameStarted);
        controller.addEventListener('gameEnded', handleGameEnded);
        controller.addEventListener('hintGenerated', handleHintGenerated);
        controller.addEventListener('difficultyChanged', handleDifficultyChanged);
        
        // Initialize state
        setGameState(controller.getGameState());
        setPerformanceStats(controller.getPerformanceStats());
        setIsAdaptiveDifficultyEnabled(controller.isAdaptiveDifficultyEnabled());
        
        setIsGameInitialized(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize game:', err);
        setError('Failed to initialize game. Please refresh the page.');
        setIsLoading(false);
      }
    };

    initializeGame();

    // Cleanup on unmount
    return () => {
      if (gameControllerRef.current) {
        gameControllerRef.current.dispose();
      }
    };
  }, []);

  // Event handlers
  const handleGameStateChange = useCallback((newGameState: GameState) => {
    setGameState(newGameState);
    
    // Clear hint when game state changes significantly
    if (newGameState.gameStatus !== 'playing') {
      setCurrentHint(null);
      setIsHintOverlayVisible(false);
    }
  }, []);

  const handleCellRevealed = useCallback((coordinate: any, cascaded: boolean) => {
    // Handle cell reveal animations and effects
    console.log(`Cell revealed at (${coordinate.x}, ${coordinate.y}), cascaded: ${cascaded}`);
  }, []);

  const handleCellFlagged = useCallback((coordinate: any, flagged: boolean) => {
    // Handle flag animations and effects
    console.log(`Cell ${flagged ? 'flagged' : 'unflagged'} at (${coordinate.x}, ${coordinate.y})`);
  }, []);

  const handleGameStarted = useCallback((difficulty: DifficultySettings) => {
    console.log('Game started with difficulty:', difficulty.name);
    setCurrentHint(null);
    setIsHintOverlayVisible(false);
  }, []);

  const handleGameEnded = useCallback((result: GameResult) => {
    console.log('Game ended:', result);
    
    // Update performance stats
    if (gameControllerRef.current) {
      setPerformanceStats(gameControllerRef.current.getPerformanceStats());
    }
    
    // Add to game history
    setGameHistory(prev => [...prev, result]);
    
    // Clear current hint
    setCurrentHint(null);
    setIsHintOverlayVisible(false);
  }, []);

  const handleHintGenerated = useCallback((hint: HintAnalysis) => {
    setCurrentHint(hint);
    setIsHintOverlayVisible(true);
  }, []);

  const handleDifficultyChanged = useCallback((newDifficulty: DifficultySettings) => {
    setSelectedDifficulty(newDifficulty);
  }, []);

  // Game actions
  const handleCellClick = useCallback((x: number, y: number, clickType: ClickType) => {
    if (!gameControllerRef.current || !gameState) return;
    
    try {
      gameControllerRef.current.handleCellClick(x, y, clickType);
    } catch (err) {
      console.error('Error handling cell click:', err);
      setError('An error occurred during gameplay. Please try again.');
    }
  }, [gameState]);

  const handleRequestHint = useCallback(async () => {
    if (!gameControllerRef.current || isGeneratingHint) return;
    
    try {
      setIsGeneratingHint(true);
      const hint = await gameControllerRef.current.requestHint();
      if (hint) {
        setCurrentHint(hint);
        setIsHintOverlayVisible(true);
      }
    } catch (err) {
      console.error('Error generating hint:', err);
      setError('Failed to generate hint. Please try again.');
    } finally {
      setIsGeneratingHint(false);
    }
  }, [isGeneratingHint]);

  const handleNewGame = useCallback(() => {
    if (!gameControllerRef.current) return;
    
    try {
      gameControllerRef.current.startNewGame(selectedDifficulty);
    } catch (err) {
      console.error('Error starting new game:', err);
      setError('Failed to start new game. Please try again.');
    }
  }, [selectedDifficulty]);

  const handleRestartGame = useCallback(() => {
    if (!gameControllerRef.current) return;
    
    try {
      gameControllerRef.current.restartGame();
    } catch (err) {
      console.error('Error restarting game:', err);
      setError('Failed to restart game. Please try again.');
    }
  }, []);

  const handleDifficultyChange = useCallback((difficulty: DifficultySettings) => {
    if (!gameControllerRef.current) return;
    
    try {
      setSelectedDifficulty(difficulty);
      if (!isAdaptiveDifficultyEnabled) {
        gameControllerRef.current.setManualDifficulty(difficulty);
      }
    } catch (err) {
      console.error('Error changing difficulty:', err);
      setError('Failed to change difficulty. Please try again.');
    }
  }, [isAdaptiveDifficultyEnabled]);

  const handleToggleAdaptiveDifficulty = useCallback(() => {
    if (!gameControllerRef.current) return;
    
    try {
      if (isAdaptiveDifficultyEnabled) {
        gameControllerRef.current.setManualDifficulty(selectedDifficulty);
        setIsAdaptiveDifficultyEnabled(false);
      } else {
        gameControllerRef.current.enableAdaptiveDifficulty();
        setIsAdaptiveDifficultyEnabled(true);
      }
    } catch (err) {
      console.error('Error toggling adaptive difficulty:', err);
      setError('Failed to toggle adaptive difficulty. Please try again.');
    }
  }, [isAdaptiveDifficultyEnabled, selectedDifficulty]);

  const handleToggleProbabilities = useCallback(() => {
    setShowProbabilities(prev => !prev);
  }, []);

  const handleCloseError = useCallback(() => {
    setError(null);
  }, []);

  // Format game timer
  const formatTime = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }, []);

  // Get remaining mine count
  const getRemainingMines = useCallback((): number => {
    if (!gameControllerRef.current) return 0;
    return gameControllerRef.current.getRemainingMineCount();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Initializing AI Minesweeper...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="app error">
        <div className="error-message">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={handleCloseError} className="error-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Main game interface
  if (!gameState || !isGameInitialized) {
    return (
      <div className="app loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>AI Minesweeper</h1>
          <p>Enhanced minesweeper with intelligent hints and adaptive difficulty</p>
        </div>
        
        <div className="header-controls">
          <div className="game-info">
            <div className="info-item">
              <span className="info-label">Mines:</span>
              <span className="info-value">{getRemainingMines()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Time:</span>
              <span className="info-value">
                {gameState.gameStatus === 'playing' 
                  ? formatTime(gameControllerRef.current?.getGameDuration() || 0)
                  : formatTime(gameControllerRef.current?.getGameDuration() || 0)
                }
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className={`info-value status-${gameState.gameStatus}`}>
                {gameState.gameStatus === 'playing' ? 'Playing' :
                 gameState.gameStatus === 'won' ? 'Won!' : 'Lost'}
              </span>
            </div>
          </div>
          
          <div className="control-buttons">
            <button 
              onClick={handleRequestHint} 
              disabled={gameState.gameStatus !== 'playing' || isGeneratingHint}
            >
              {isGeneratingHint ? '🔄 Generating...' : '💡 Hint'}
            </button>
            <button onClick={handleToggleProbabilities}>
              {showProbabilities ? '🎯 Hide Probabilities' : '🎯 Show Probabilities'}
            </button>
            <button onClick={() => setIsStatsPanelVisible(true)}>
              📊 Stats
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="game-container">
          <div className="game-controls">
            <div className="difficulty-controls">
              <label htmlFor="difficulty-select">Difficulty:</label>
              <select
                id="difficulty-select"
                value={selectedDifficulty.name}
                onChange={(e) => {
                  const preset = Object.values(DIFFICULTY_PRESETS).find(p => p.name === e.target.value);
                  if (preset) handleDifficultyChange(preset);
                }}
                disabled={isAdaptiveDifficultyEnabled}
              >
                {Object.values(DIFFICULTY_PRESETS).map(preset => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name} ({preset.width}×{preset.height}, {preset.mineCount} mines)
                  </option>
                ))}
              </select>
              
              <label className="adaptive-toggle">
                <input
                  type="checkbox"
                  checked={isAdaptiveDifficultyEnabled}
                  onChange={handleToggleAdaptiveDifficulty}
                />
                Adaptive Difficulty
              </label>
            </div>
            
            <div className="game-actions">
              <button onClick={handleNewGame} className="new-game-button">
                🎮 New Game
              </button>
              <button onClick={handleRestartGame} className="restart-button">
                🔄 Restart
              </button>
            </div>
          </div>

          <div className="game-board-container">
            <GameGrid
              board={gameState.board}
              gameStatus={gameState.gameStatus}
              onCellClick={handleCellClick}
              hint={showProbabilities ? currentHint : null}
              showProbabilities={showProbabilities}
              disabled={gameState.gameStatus !== 'playing'}
            />
          </div>
        </div>

        {/* Hint Overlay */}
        <HintOverlay
          hint={currentHint}
          isVisible={isHintOverlayVisible}
          displayMode={hintDisplayMode}
          onDisplayModeChange={setHintDisplayMode}
          onClose={() => setIsHintOverlayVisible(false)}
        />

        {/* Statistics Panel */}
        {performanceStats && (
          <StatisticsPanel
            performance={performanceStats}
            gameHistory={gameHistory}
            isVisible={isStatsPanelVisible}
            onClose={() => setIsStatsPanelVisible(false)}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>AI Minesweeper - Enhanced with intelligent assistance</p>
          <div className="footer-links">
            <button onClick={() => setIsStatsPanelVisible(true)}>
              View Statistics
            </button>
            {gameControllerRef.current?.isOffline() && (
              <span className="offline-indicator">🔌 Offline Mode</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;