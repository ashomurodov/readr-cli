# 📚 readr-cli

A beautiful terminal tool to track your reading sessions, speed, and estimated completion time.

## Install

```bash
npm install -g readr-cli
```

## Usage

```bash
readr add      # Add a new book
readr start    # Start a reading session
readr pause    # Pause or resume current session
readr stop     # End session & log pages read
readr list     # All books with progress & ETA
readr stats    # Overall reading statistics
readr help     # Show help
```

## Features

- 📊 **Progress bars** — visual % complete for every book
- ⚡ **Reading speed** — calculated from your real sessions (pages/hr)
- 🕐 **ETA** — estimated time to finish based on your personal speed
- ⏸ **Pause/resume** — break time is excluded from speed calculations
- 💾 **Persistent data** — stored locally in `~/.reading-cli/data.json`

## Example

```
📖 The Beginning After The End by TurtleMe
   [██████░░░░░░░░░░░░░░░░░░░░░░░░] 20.6%
   Page: 247 / 1200  Sessions: 3  Time: 4h 12m
   Speed: 33.2 pages/hr  ETA: 28h 43m left
```

## Requirements

Node.js 18 or higher.
