# TalentHub Backend

## Stack
- Node.js + Express
- Prisma + SQLite
- JWT auth + role-based access control
- Zod validation
- Pino logging
- Vitest + Supertest + Playwright

## Setup
1. Copy `.env.example` to `.env`.
2. Install packages:
   - `npm install`
3. Generate client and create DB:
   - `npm run prisma:generate`
   - `npm run prisma:push`
4. Run server:
   - `npm run dev`

## API Base
- `http://localhost:4000/api`

## Auth Endpoints
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

## CRUD Endpoints
- `/users`
- `/students`
- `/companies`
- `/universities`
- `/jobs`
- `/skills`

All CRUD routes support:
- `GET /?page=1&limit=10&q=search`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`
