# Bugema University Campus Lost & Found Management System

This frontend project is a demonstration-only lost and found platform for Bugema University. It is built with HTML5, CSS3 and vanilla JavaScript, and uses browser `localStorage` for temporary data storage.

## Features

- Public landing page and campus branding
- Student registration and login
- Lost item and found item reporting
- Search, filter and item detail pages
- Claim submission and status tracking
- Student dashboard and admin dashboard
- Notifications and mock analytics
- Service layer prepared for future API integration

## Demo credentials

Student login
- Email: sarah@student.bugema.ac.ug
- Password: student123

Admin login
- Email: admin@bugema.ac.ug
- Password: admin123

## Running locally

Open the folder in VS Code and run a local static server. For example:

```bash
cd campus-lost-found
python -m http.server 8000
```

Then visit `http://localhost:8000` in the browser.

## Warning

This frontend is intentionally not connected to MongoDB. It uses local mock data and is prepared for future integration through a Node.js/Express backend.
