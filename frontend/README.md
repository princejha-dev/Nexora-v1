# 🎨 Nexora — Frontend

The Nexora frontend is a high-performance React application designed for investigative journalists to visualize and interact with complex document networks.

## 🚀 Tech Stack

- **Framework**: React 18 (Vite)
- **State Management**: Zustand (with persistent project caching)
- **Visualization**: `react-force-graph-2d` (Custom Canvas Rendering)
- **Styling**: Tailwind CSS
- **Real-time**: Server-Sent Events (SSE) for live telemetry and graph construction.

## 🌟 Key Features

- **Dynamic Knowledge Graph**: Interactive nodes and links with physics-based layout.
- **Investigative Chat**: A dedicated panel for querying the investigation using RAG.
- **Findings Dashboard**: View automatically detected anomalies with suspicion scores.
- **Live Terminal**: A side-panel that shows real-time logs from the AI agent pipeline.

## 🛠️ Setup

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create a `.env` file:
```env
VITE_API_URL=http://localhost:8000
```

## 🏗️ Architecture Note
The frontend uses a **Zustand** store (`src/store/useStore.js`) as the central source of truth. When the AI backend extracts entities, they are streamed via SSE and added to the store in real-time, causing the graph to "grow" dynamically before the user's eyes.
