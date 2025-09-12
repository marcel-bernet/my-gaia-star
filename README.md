 
## Deploying

This project is set up for deployment to [Railway](https://railway.com) as two separate services:

### Backend (FastAPI)
- Go to the `backend/` folder and create a new Railway service.
- Add the following as your start command (or use the included `Procfile`):
  ```
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```
- Ensure all dependencies are in `requirements.txt`.
- Railway will automatically use the `PORT` environment variable.

### Frontend (Vite/React)
- Go to the `frontend/` folder and create a new Railway service.
- Railway will auto-detect the build and serve scripts from `package.json`.
- The static site will be served from the `dist/` directory after build.

### Configuration
- Frontend expects `VITE_API_URL` to point to the backend base URL (e.g., `https://api.example.com`). If not set, it defaults to `http://localhost:8000`.
- CORS is enabled to allow the frontend to communicate with the backend.

### Notes
- You can connect both services to the same Railway project for easy management.
- Set up CORS in the backend (already enabled for all origins).
- For custom domains, use Railway’s dashboard after deployment. 

### Local Development
Backend
1. Create a virtual environment and install `backend/requirements.txt`.
2. Run:
   ```
   uvicorn main:app --reload
   ```

Frontend
1. From `frontend/`, install dependencies:
   ```
   npm install
   ```
2. Start dev server:
   ```
   npm run dev
   ```