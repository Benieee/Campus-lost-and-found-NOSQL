# Bugema University Campus Lost & Found Management System (Proposed System)

> **Project Notice:** This is a **proposed university student project** referencing Bugema University. It has **not** been officially adopted or deployed by Bugema University. All seeded users, reports, found items, and claims are completely fictional.

A full-stack, responsive web application built with **React, TypeScript, Node.js, Express, and MongoDB (Mongoose)** that enables students to report lost property, log found items, discover suggested matches, and submit ownership claims verified by authorized campus staff.

---

## Repository Structure

```text
.
├── backend/                 # Express + TypeScript + Mongoose REST API
│   ├── src/
│   │   ├── config/          # Environment validation & MongoDB connection
│   │   ├── constants/       # Shared domain enums (roles, categories, statuses)
│   │   ├── middleware/      # Auth/RBAC, sanitization, rate limiting, magic-byte image upload
│   │   ├── models/          # User, Location, LostItem, FoundItem, Claim, AuditLog
│   │   ├── routes/          # Auth, Lost, Found, Claims, Locations, Uploads, Admin, Public
│   │   ├── seed/            # Fictional demo data seed script
│   │   └── services/        # Audit logger & similarity-based match suggestion engine
│   ├── tests/               # Automated Vitest + Supertest + MongoDB Memory Server tests
│   └── .env.example
├── frontend/                # React + TypeScript + Vite responsive web app
│   ├── src/
│   │   ├── api/             # Typed fetch client
│   │   ├── components/      # Layout, ProtectedRoute, StatusBadge, ConfirmDialog, Pagination
│   │   ├── context/         # AuthContext (session state)
│   │   ├── pages/           # Public, Student, and Staff Admin pages
│   │   └── styles/          # Accessible responsive CSS design system
│   └── .env.example
├── campus-lost-found/       # Earlier vanilla HTML/JS prototype preserved for reference
├── render.yaml              # Render Blueprint for production Node.js deployment
└── package.json             # Root convenience scripts
```

---

## Key Features & Security Controls

- **Role-Based Access Control (Enforced on Backend):**
  - **Student:** Register, sign in/out, submit/edit/withdraw own lost reports, report found items, browse listings, view suggested matches, submit ownership claims, and track claim review statuses.
  - **Administrator / Staff:** View live dashboard counts, review claims with side-by-side comparison of private found-item intake marks vs. claimant proof, record verification notes, approve/reject claims, manage lost/found records, manage user roles/active status, manage campus locations & holding desks, and inspect the audit trail.
- **Privacy Protection:**
  - Private `identifyingDetails` on found items are never exposed to unauthenticated visitors or other students, preventing fraudulent claims.
  - Private student profiles and contact information are omitted from public responses.
  - Passwords are stored exclusively as `bcryptjs` hashes; passwords, tokens, and sensitive claim proof are never logged or written to `AuditLog`.
- **Upload & API Security:**
  - Uploaded images are inspected by **binary magic bytes** (JPEG, PNG, WebP, GIF, max 2 MB) rather than trusting client filenames or MIME types, and saved under random UUID filenames with `X-Content-Type-Options: nosniff`.
  - Server-side `zod` input validation, recursive NoSQL operator sanitization, `helmet` headers, explicit CORS origin configuration, `httpOnly` auth cookies, and rate limiting on authentication and claim submission endpoints.
- **Suggested Matching (Advisory Only):**
  - Matches lost and found items by category, campus location similarity, shared keywords, and date proximity, always labeled as suggestions requiring staff verification before release.

---

## Prerequisites

- **Node.js** `>= 18.18.0` and **npm** `>= 9`
- **MongoDB** `>= 6.0` (either a local MongoDB instance or a free **MongoDB Atlas** cluster)

---

## Local Setup & Installation

1. **Install dependencies for both workspaces:**
   ```bash
   npm run install:all
   ```

2. **Configure environment variables:**
   Copy the sample `.env.example` files and fill in your local values (never commit `.env` files):
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Key variables in `backend/.env`:
   - `MONGODB_URI` — e.g. `mongodb://127.0.0.1:27017/CampusLostFound` or your MongoDB Atlas URI
   - `JWT_SECRET` — strong random string (at least 32 characters required in production)
   - `FRONTEND_ORIGIN` — `http://localhost:5173` for local Vite development
   - `PORT` — `4000`

3. **Seed fictional demonstration data:**
   Seeds 6 fictional users (2 staff + 4 students), 8 campus locations, 6 lost reports, 6 found items, 5 claims, and initial audit log entries:
   ```bash
   npm run seed
   ```
   To wipe and re-seed from scratch:
   ```bash
   npm --prefix backend run seed:reset
   ```

   **Fictional Demo Accounts (Local Demo Only):**
   - **Staff Admin:** `staff.admin@example.edu` / `StaffDemo!2026`
   - **Student:** `amina.nakato@example.edu` / `StudentDemo!2026`
   - **Student:** `brian.ssemwogerere@example.edu` / `StudentDemo!2026`

4. **Run locally in development mode:**
   Start the backend API and frontend dev server in two terminals:
   ```bash
   # Terminal 1 — Express API on http://localhost:4000
   npm run dev:backend

   # Terminal 2 — React + Vite app on http://localhost:5173
   npm run dev:frontend
   ```
   Vite proxies `/api` and `/uploads` automatically to `http://localhost:4000`.

---

## Testing & Verification

Run the automated backend integration tests (powered by **Vitest**, **Supertest**, and **mongodb-memory-server**, so no external MongoDB daemon is required to run tests) plus frontend TypeScript verification:

```bash
npm test
```

Build both frontend and backend for production:
```bash
npm run build
```

---

## Deployment (Render + MongoDB Atlas)

The repository includes a [render.yaml](render.yaml) Blueprint that builds the React frontend, compiles the Express TypeScript backend, and serves the frontend static bundle and `/api` routes from a single Node.js web service.

### Required External Services
1. **MongoDB Atlas (Database):**
   - Create a MongoDB Atlas cluster and a database user with `readWrite` permissions on the `CampusLostFound` database.
   - Add Render's outbound IPs (or restrict network access appropriately) in Atlas Network Access.
   - Copy the SRV connection string into Render's `MONGODB_URI` environment variable.
2. **External Object Storage (Recommended for Persistent Images):**
   - Local disk uploads in `backend/uploads/` work for local development and persistent-disk servers, but **Render's free tier uses an ephemeral filesystem** (uploaded images are cleared on redeploy/restart).
   - For persistent image uploads in production, connect an external object storage service such as **Cloudinary**, **AWS S3**, or **Cloudflare R2** (or attach a Render Persistent Disk mounted at `UPLOAD_DIR`).

### Deploying on Render
1. Push this repository to GitHub.
2. In Render, choose **New -> Blueprint** and select the repository.
3. Set the required secret environment variables in Render:
   - `MONGODB_URI`: your MongoDB Atlas connection string
   - `FRONTEND_ORIGIN`: your deployed Render URL (e.g. `https://bugema-campus-lost-found.onrender.com`)
   - `JWT_SECRET`: auto-generated by `render.yaml`
4. Deploy and verify `GET https://<your-service>.onrender.com/api/health` returns `{"status":"ok","database":"connected"}`.
5. Optionally seed demo data once against a staging database, or register your first account and promote an administrator directly in MongoDB Atlas (`role: "admin"`).
