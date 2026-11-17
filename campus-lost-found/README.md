# Bugema University Campus Lost & Found

The application uses a Node.js API between the static frontend and MongoDB. The browser never connects directly to MongoDB.

## Database

The server connects to the existing `CampusLostFound` database with:

```text
mongodb://localhost:27017/CampusLostFound
```

It uses the existing `students`, `lostItems`, `foundItems`, and `claims` collections. At startup it verifies that all four collections exist and exits with an error if one is missing. It does not seed demo data or create collections.

New registrations are stored with a scrypt-hashed password. Legacy plain-text passwords already in the `students` collection are accepted for compatibility; migrate those records before production use.

Notifications remain browser-local because the existing database schema does not include a notifications collection.

## Run locally

1. Make sure MongoDB is running and the four existing collections are present in `CampusLostFound`.
2. From this folder, install the Node.js dependencies:

   ```powershell
   npm install
   ```

3. Optionally copy `.env.example` to `.env` and set `MONGODB_URI`, `PORT`, and a strong `SESSION_SECRET`.
4. Start the app:

   ```powershell
   npm start
   ```

5. Open `http://localhost:3000`.

The server defaults to `mongodb://localhost:27017/CampusLostFound`. Set a different `MONGODB_URI` in `.env` if needed. Do not put database credentials in frontend files or commit `.env`.

## API

- `GET /api/health` — database connectivity
- `GET /api/state` — public item lists and session-scoped data
- `POST /api/auth/login` and `POST /api/auth/logout`
- `POST /api/students` — student registration
- `GET /api/students` — administrator only
- `/api/lost-items`, `/api/found-items` — item reporting and administration
- `/api/claims` — claim submission and administrator decisions

The API uses cookie sessions. The default in-memory session store is suitable only for local development; configure a persistent session store and HTTPS before deployment.
