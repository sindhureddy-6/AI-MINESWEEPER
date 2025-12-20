# AI Minesweeper

An enhanced version of the classic Minesweeper game with AI-powered hints, adaptive difficulty, and modern web interface.

## Features

- Classic minesweeper gameplay with modern controls
- AI-powered hint system with probability analysis
- Adaptive difficulty that responds to player skill
- Smooth animations and visual effects
- Performance tracking and statistics
- Cross-platform support (desktop and mobile)
- Offline gameplay capability.

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Testing**: Vitest with fast-check for property-based testing
- **Styling**: CSS with responsive design

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Linting

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint:fix
```

## Project Structure

```
src/
├── types/          # TypeScript interfaces and types
├── utils/          # Helper functions and constants
├── test/           # Test setup and utilities
├── App.tsx         # Main application component
├── main.tsx        # Application entry point
└── index.css       # Global styles
```

## Development Workflow

This project follows a spec-driven development approach. See `.kiro/specs/ai-minesweeper/` for:
- `requirements.md` - Feature requirements and acceptance criteria
- `design.md` - System architecture and design decisions
- `tasks.md` - Implementation task list

## Testing Strategy

The project uses a dual testing approach:
- **Unit Tests**: Verify specific examples and edge cases
- **Property-Based Tests**: Verify universal properties across randomized inputs using fast-check

All property-based tests run a minimum of 100 iterations to ensure statistical confidence.

## License

MIT
