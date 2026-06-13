# Contributing

## Local Setup

1. Install dependencies from the root, backend, and frontend packages.
2. Copy `backend/.env.example` to `backend/.env` and set real local secrets.
3. Copy `frontend/.env.example` to `frontend/.env` when the API URL differs from the example.
4. Run `npm run build` before opening a pull request.

## Standards

- Keep backend business rules in `service` files.
- Keep HTTP parsing and responses in `controller` files.
- Keep frontend API calls in `frontend/src/services`.
- Do not commit `.env`, `node_modules`, `dist`, logs, or generated local output.
- Every point balance change must create a `PointTransaction`.
