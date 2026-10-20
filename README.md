**MURANG'A PUBLIC SERVICE REQUEST PORTAL**
## Overview
This web service allows residents to submit service requests to the government such as garbage disposal, streetlights, poor roads et cetera. The deployment URL is https://public-service-request-system-l1cj.onrender.com/html/index.html

## Core Features
 - Service request submission with optional image uploads
 - Unique tracking codes for follow ups
 - Signed-in accounts can view their request history
 - Administrator dashboard with simple summaries and monthly trends
 - Admin request search, pagination and filtering
 - Admins update service request statuses

## Security Considerations
 - Rate limiting on all public APIs
 - Protected admin ednpoints

## Features to add
 - Password reset
 - User information updates

## Tech Stack
**Frontend:** Vanilla HTML, CSS and Javascript
**Backend:** Express
**Database:** SQLite via better-sqlite3
**Authentication:** Express Sessions with bcryptjs for password hashing
**Media Uploads:** Multer
**Deployment:** Render

## Installation & Setup
# Prerequisites
 - Node.js 22 or newer
 - npm

## 1. Clone the Repository

git clone https://github.com/cal847/public-service-request-system.git

## 2. Run the Project
Navigate to the root directory and run

npm start

The server defaults to http://localhost:3000. Open / to reach the portal. The static pages are also available at:

 - /html/index.html — resident portal
 - /html/login.html — sign in
 - /html/register.html — create a resident account
 - /html/admin.html — administrator dashboard page

 ## 3. Admin Setup
On the initial start, you will be prompted to set up the admin account. The default values will be:

 admin@muranga.go.ke
 service_request_admin

## Optional Seed Data
The project includes demo data at server/seed-data.js. If you would like to prepopulate the database with said data, run:

  npm run seed

## Project Layout

  public/
  css/           Stylesheets
  html/          Resident, authentication, and admin pages
  images/        Portal images and decorative assets
  js/            Browser-side behavior server
  middleware/    Authentication and authorization middleware
  routes/        Authentication, request, and admin APIs
  utils/         Validation, constants, and tracking-code helpers
  db.js          SQLite connection, schema initialization, admin bootstrap