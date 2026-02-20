# Contributing to SCMS

Thank you for your interest in contributing.

## How to contribute

1. **Fork** the repository and clone your fork.
2. **Create a branch** for your change (`git checkout -b feature/your-feature`).
3. **Set up** the project (see [README Quick Start](README.md#-quick-start)). Use `backend/env.example` to create `backend/.env`; never commit `.env`.
4. **Make your changes** and test (backend: `npm run dev`, frontend: `npm start`).
5. **Commit** with clear messages.
6. **Push** to your fork and open a **Pull Request** against `main`.

## Before submitting

- Ensure the app runs with the steps in the README (Node, MongoDB, `db:migrate`, `db:seed`).
- Do not commit `.env`, `node_modules`, or build artifacts (see [.gitignore](.gitignore)).

For questions or ideas, open an issue on GitHub.
