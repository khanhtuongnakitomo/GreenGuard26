# GreenPoint Full-Stack App

GreenPoint is a recycling reward wallet with a modular TypeScript backend and a Vite React frontend.

## Structure

```text
backend/   Express, TypeScript, MongoDB, Mongoose
frontend/  React, TypeScript, Vite
```

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Seed demo data:

```bash
npm run seed
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `VITE_API_URL`, defaulting to `http://localhost:4000/api`.

## Core Rule

Every point change must be recorded in `PointTransaction`. `User.totalPoints` is only a cached balance for fast reads.
