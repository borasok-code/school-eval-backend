# School Evaluation Platform (Starter)

## Run backend (local)
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

Set `DATABASE_URL` in `backend/.env` to your local Postgres or Neon connection string.

## Run frontend (local)
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Notes
- The app uses PostgreSQL (Neon works well for local + prod).
- Seed data is in `school_standards_indicators.json`.
- `CORS_ORIGIN` supports comma-separated origins.

## Deployment (Render + Neon)

### Neon (Postgres)
1) Create a Neon database (Free tier).
2) Copy the connection string into `DATABASE_URL`.

Environment variables (set securely in the provider dashboard):
- `DATABASE_URL` (PostgreSQL connection string for production)
- `PORT` (platform sets this automatically; keep support in app)
- `CORS_ORIGIN` (frontend URL, e.g. https://your-frontend.example; supports comma-separated)
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (use \n escaped newlines)
- `DRIVE_FOLDER_ID` (default: 1ZlVeuiyT5jk8E8peOwO06pAJT_qelnWZ)

### Render Web Service (backend)
Build command:
```bash
npm install
```
Start command:
```bash
npm run migrate:deploy && npm start
```

### Render Static Site (frontend)
Build command:
```bash
npm install && npm run build
```
Publish/output directory: `dist`

Frontend environment variable:
- `VITE_API_URL` (e.g. https://your-backend.example)

### Google Drive (evidence uploads)
1) Create a normal Drive folder (not Shared Drive).
2) Share the folder with the service account email as **Editor**.
3) Set `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `DRIVE_FOLDER_ID`.
