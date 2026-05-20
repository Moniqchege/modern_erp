# Modern ERP (Starter Scaffold)

This workspace contains a fresh starter scaffold for a modern ERP system.

## Folders
- `backend/` — Express.js + TypeScript + Prisma + MySQL
- `frontend/` — React (Vite) + TypeScript + Tailwind + Lucide

## Environment Variables
Create a `.env` file in `backend/`:

## Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Frontend
In another terminal:
```bash
cd frontend
npm install
npm run dev
```

