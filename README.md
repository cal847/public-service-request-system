# Murang'a County Public Services Portal

A web application for residents to submit local service requests and follow their progress, and for county administrators to review requests, update statuses, and send notes to residents.

## User flows

### Residents

1. Open the portal and submit a request. Residents can submit as guests or while signed in.
2. Choose a category, provide a location and description, and optionally attach a photo.
3. Save the tracking code shown after submission.
4. Search by tracking code to view the request status and latest county update.
5. Create an account or sign in to view requests associated with that account.

Guest requests are not associated with a user account. A guest should keep their tracking code to look up the request later.

### Administrators

1. Sign in with an administrator account to open the dashboard.
2. Review request totals and recent activity.
3. Search, filter, and page through requests; open a request to review its details and history.
4. Move requests through the allowed sequence: **Pending → In Progress → Resolved**.
5. Add a note when changing status. The latest status-change note is available to residents through tracking.

There is no public administrator registration flow. Administrator accounts are bootstrapped when the database is initialized; see [Administrator setup](#administrator-setup).

## Features

- Guest and account-linked request submissions
- Categories: Streetlight, Water, Garbage collection, Roads, and Other
- Optional JPEG, PNG, or WebP photo uploads (maximum 5 MB)
- Unique tracking codes and public request lookup
- Signed-in resident request list with status and latest update
- Administrator dashboard with status/category summaries, monthly trends, and recent activity
- Admin request search, filtering, pagination, detail history, and status updates with notes
- Account registration and sign-in using email or phone number
- Responsive layouts, dark mode, and accessibility display options

## Technology stack

- **Runtime:** Node.js 22 or newer
- **Server:** Express 4
- **Database:** SQLite via `better-sqlite3`
- **Authentication:** Express sessions and `bcryptjs` password hashing
- **Uploads:** Multer, with server-side image type and file-signature checks
- **Frontend:** HTML, CSS, and browser JavaScript; no frontend build step

## Run locally

### Prerequisites

- Node.js 22 or newer
- npm

### Install and start

From the repository root:

```sh
npm ci
npm start
```

For development with Node's file watcher:

```sh
npm run dev
```

The server defaults to `http://localhost:3000`. Open `/` to reach the portal. The static pages are also available at:

- `/html/index.html` — resident portal
- `/html/login.html` — sign in
- `/html/register.html` — create a resident account
- `/html/admin.html` — administrator dashboard page (its API endpoints require an admin session)

The SQLite database is created automatically at `server/data/app.db`; uploaded images are stored in `server/uploads/`.

### Administrator setup

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` **before the first application start**, while the database has no administrator account. For example, in PowerShell:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "Use-A-Unique-Strong-Password"
$env:SESSION_SECRET = "replace-with-a-long-random-secret"
npm start
```

The database initializer creates an administrator only when no admin already exists. Changing these environment variables later does **not** update an existing account's email or password. The application currently has fallback bootstrap credentials in its source; never rely on those defaults or expose them in a deployed environment. The application does not provide an admin password reset or admin-management screen.

### Optional demo data

To populate a local database with demonstration residents, requests, and history:

```sh
npm run seed
```

Alternatively, set `SEED_DEMO=true` before starting the server. Demo data includes predictable sample accounts and must only be used in a disposable local environment—not in production. The seed command is intended for an empty/demo database and does not act as a database migration.

## Important API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register a resident and sign them in |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/auth/me` | Return the signed-in user's account |
| `POST` | `/api/service-requests` | Submit a request (guest or signed-in) |
| `GET` | `/api/service-requests/me` | List requests for the signed-in resident |
| `GET` | `/api/service-requests/track/:code` | Look up a request using its tracking code |
| `GET` | `/api/admin/stats` | Get dashboard summaries (admin only) |
| `GET` | `/api/admin/requests` | Search/filter/page requests (admin only) |
| `GET` | `/api/admin/requests/:id` | Get request details and history (admin only) |
| `PATCH` | `/api/admin/requests/:id/status` | Change status and record an admin note (admin only) |
| `GET` | `/healthz` | Health check (currently requires the database-binding correction noted below) |

## Project layout

```text
public/
  css/           Stylesheets
  html/          Resident, authentication, and admin pages
  images/        Portal images and decorative assets
  js/            Browser-side behavior
server/
  middleware/    Authentication and authorization middleware
  routes/        Authentication, request, and admin APIs
  utils/         Validation, constants, and tracking-code helpers
  db.js          SQLite connection, schema initialization, admin bootstrap
```
