# Frontend React (Vite)

This folder is a starting point to convert the original EJS views into a React app served by Vite.

Quick start:

1. cd frontend-react
2. npm install
3. npm run dev

Notes:
- Static assets (images, audio, css) are kept in the top-level `frontend/public`. You can copy them into `frontend-react/public` or reference them via the backend static route `/public/...`.
- Next steps: convert each EJS template into React components and wire API calls to the backend.

Dev server behavior
-------------------

- The Vite dev server is configured to proxy `/api` and `/public` to the backend at `http://localhost:3000` so you can run frontend and backend separately during development.
- Start backend first (`npm start` from project root), then run the React dev server (`npm run dev` in `frontend-react`).

Production build
----------------

- Build the React app with `npm run build` (inside `frontend-react`). The output will be in `frontend-react/dist`.
- Update the backend to serve the built files from `frontend-react/dist` (I'll add a small snippet or script for that once you confirm where you want the backend to serve the static build).

If you want I can:

1. Add scripts to the root `package.json` to build and copy the frontend `dist` into a `backend/public` folder for production.
2. Start converting EJS pages into full React pages (I can continue with Home/Playlist/Track conversion).
