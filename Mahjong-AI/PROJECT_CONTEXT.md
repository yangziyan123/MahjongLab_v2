# Mahjong-AI Project Context

## Purpose
This repository is a Riichi Mahjong AI project inspired by Suphx. It currently contains:

- data download scripts for Tenhou logs
- supervised learning training scripts
- Mahjong game/environment logic
- an online game server
- a terminal client
- a web client

This file is intended to be a permanent context note for future development work.

## How We Start The Project

### Environment
- OS used during setup: Windows + PowerShell
- Python used successfully: `3.11.11`
- Virtual environment already exists in `.venv`

### Install dependencies
From the repo root:

```powershell
cd d:\project_majiang\Mahjong-AI
.\.venv\Scripts\python -m pip install -U pip
.\.venv\Scripts\python -m pip install -r .\requirements.txt
```

Installed dependencies include `torch`, `torchvision`, `quart`, `websockify`, `numpy`, `scikit-learn`, etc.

### Start the game server
This starts the core Mahjong server with 3 AI players and leaves 1 seat for a human player:

```powershell
cd d:\project_majiang\Mahjong-AI
.\.venv\Scripts\python .\online_game\server.py -A 3 -H 127.0.0.1 -P 9999 -d
```

Notes:
- `-A 3` means 3 AI players
- `-P 9999` means the raw socket server listens on port `9999`
- `-d` enables debug logging

### Start the web socket proxy for the browser client
The browser client does not connect directly to the raw socket server. It connects through `websockify`.

```powershell
cd d:\project_majiang\Mahjong-AI
.\.venv\Scripts\websockify 8888 127.0.0.1:9999
```

Meaning:
- browser websocket port: `8888`
- backend game server port: `9999`

### Start the static web page

```powershell
cd d:\project_majiang\Mahjong-AI\online_game\web_client
..\..\ .venv\Scripts\python -m http.server 8080
```

Important: the actual command should be typed without the extra visual break:

```powershell
cd d:\project_majiang\Mahjong-AI\online_game\web_client
..\..\.venv\Scripts\python -m http.server 8080
```

Then open:

- [http://127.0.0.1:8080/index.html](http://127.0.0.1:8080/index.html)

### Browser connection values
Inside the web page, use:

- host: `127.0.0.1`
- port: `8888`
- username: any non-empty value such as `User1`
- observer mode: unchecked if playing, checked if spectating

### Important clarification
Running the terminal client is optional.

The command below is only for the terminal-based client, not required for the web version:

```powershell
.\.venv\Scripts\python .\online_game\client.py -U User1 -H 127.0.0.1 -P 9999
```

For terminal spectating:

```powershell
.\.venv\Scripts\python .\online_game\client.py -ob -H 127.0.0.1 -P 9999
```

If the browser client is already working, the terminal client does not need to be started.

## Current Project Structure

### `dataset/`
Scripts for downloading Mahjong logs and raw data.

### `sl_train/`
Supervised learning training scripts for:

- discard model
- riichi model
- furo models such as chi/pon/kan

### `mahjong/`
Core Mahjong domain logic:

- game flow
- agent state
- agari/yaku checks
- tile utilities
- display helpers

This is the main rules/engine layer.

### `model/`
PyTorch model definitions. Current model classes include:

- `DiscardModel`
- `RiichiModel`
- `FuroModel`
- `RewardPredictor`

### `online_game/`
Networking and playable experience:

- `server.py`: socket game server and room/game loop
- `client.py`: terminal client
- `web_client/`: browser client

## What The Server Does

`online_game/server.py` is the runtime center of the playable game.

High-level responsibilities:

- accepts TCP client connections
- manages room join/rejoin/observe behavior
- creates a `GameEnvironment`
- runs the game loop
- sends per-event messages to clients
- lets humans choose actions from messages
- lets AI choose actions through `AiAgent`

The server uses newline-delimited JSON messages over a raw socket connection.

## What The Web Client Does

The browser client is in `online_game/web_client/`.

Observed behavior:

- page loads a UI for host, port, username, observer mode
- connects with websocket to `ws://host:port`
- sends JSON messages terminated by `\n`
- receives buffered newline-delimited JSON messages
- renders hand, river, furos, actions, settlement, score

The websocket logic is implemented in `online_game/web_client/js/src/communication.js`.

Important detail:
- username is required by the web client UI
- websocket default port in the page is `8888`
- the page defaults host to `window.location.hostname`

## AI / Model Loading Behavior

The AI logic is in `mahjong/agent.py` under `AiAgent`.

At startup it attempts to load these weights if they exist:

- `model/saved/discard-model/best.pt`
- `model/saved/riichi-model/best.pt`
- `model/saved/chi-model/best.pt`
- `model/saved/pon-model/best.pt`
- `model/saved/kan-model/best.pt`

Important current behavior:
- missing model files do not crash the game
- if a model is missing, the corresponding AI behavior falls back to simple/random behavior
- this is why the game can still run even without pretrained weights

This is useful for local UI and gameplay development.

## Gameplay / Product Understanding So Far

The implemented game is a four-player Riichi Mahjong game with:

- South round game
- red fives
- open tanyao
- ippatsu
- multiple draw/abortive draw conditions
- observe mode

There are two main ways to interact:

- terminal client
- browser client

For normal local development, the browser path is the most convenient.

## Messaging Model

The server and clients communicate with event-style JSON payloads. Common events seen in the code:

- `join`
- `start`
- `update`
- `draw`
- `discard`
- `chi`
- `pon`
- `kan`
- `addkan`
- `riichi`
- `agari`
- `ryuukyoku`
- `settlement`
- `select_tile`
- `decision`
- `score`
- `end`
- `quit`

This event protocol is important context for any future feature work involving UI, networking, replay, bots, or debugging.

## Notable Implementation Details

### 1. Raw socket backend + websocket bridge
The playable browser version is not a standalone HTTP API app. It is:

- raw socket Mahjong server on `9999`
- websocket bridge on `8888`
- static web page on `8080`

So if future work touches connection logic, all three layers matter.

### 2. Server is stateful and room-oriented
The server manages:

- current clients
- observers
- reconnect behavior
- game start conditions
- round progression

This means features like matchmaking, multi-room support, persistence, and replay will likely require careful server refactoring.

### 3. Frontend is event-driven, not REST-driven
The web client reacts to pushed events from the server rather than polling an HTTP API.

### 4. Terminal client is secondary
The terminal client is useful for debugging and manual fallback, but the browser client is likely the better default target for future UX work.

## Known Friction / Caveats

### Startup complexity
To run the browser version locally, three pieces are involved:

1. backend socket server
2. websocket proxy
3. static file server

This is workable, but not ideal for developer ergonomics.

### PowerShell argument pitfall
Using terminal observe mode with `-U ""` caused an argparse issue in PowerShell. Safer forms are:

```powershell
.\.venv\Scripts\python .\online_game\client.py -ob -H 127.0.0.1 -P 9999
```

or

```powershell
.\.venv\Scripts\python .\online_game\client.py -U User1 -H 127.0.0.1 -P 9999
```

### README has a minor command issue
The README shows:

```powershell
python http.server -m 8080
```

The correct command is:

```powershell
python -m http.server 8080
```

## Recommended Future Development Priorities

If we continue building on this project, likely high-value areas are:

- simplify local startup into one command/script
- document the event protocol more formally
- improve AI/model weight management
- improve browser UX and error handling
- add clearer logs for connection, room, and action flow
- evaluate whether to keep raw socket + websockify or replace with a native websocket/backend approach

## Suggested Development Mindset For Future Changes

When adding new features, it will help to think in these layers:

1. Mahjong rules / domain logic in `mahjong/`
2. AI decision logic in `mahjong/agent.py` and `model/`
3. server event generation in `online_game/server.py`
4. web client event handling/rendering in `online_game/web_client/`

Most user-facing features will touch at least layers 3 and 4. Rule changes may also touch layer 1.

## Current Status Snapshot

At the time this note was written:

- dependencies were installed successfully in `.venv`
- backend server was started successfully on `127.0.0.1:9999`
- `websockify` was started successfully on `8888`
- static web page was served successfully on `8080`
- the browser client was able to open and play

This confirms that the project is locally runnable on the current machine.
