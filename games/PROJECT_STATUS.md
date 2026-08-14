# Arcade Project Status

Arcade is a frontend-only game playground at `/games/`. It contains three games behind one selection screen and preserves the portfolio header and visual language.

## Included games

- Snake: increasing speed, collision rules, scoring, and a locally saved best score.
- Tetris: seven pieces, rotation with wall kicks, ghost piece, line clearing, levels, scoring, and next-piece preview.
- Cosmic Drift: inertial flight, shooting, rock splitting, three waves, lives, and collision recovery.

## Input and responsive behavior

- Desktop: Arrow keys or WASD, Space, P to pause, and R to restart.
- Touch: game-specific thumb controls. Snake and Tetris also accept gestures on the canvas.
- The player uses a fixed logical canvas with responsive CSS scaling, preserving gameplay geometry at every display size.

No account, network request, backend, build step, or third-party runtime dependency is required.
