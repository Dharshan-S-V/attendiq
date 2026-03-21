# AttendIQ — QR Attendance System

Full-stack attendance system with GPS verification.
**Stack:** Next.js · PostgreSQL (Neon) · Vercel

---

## 🗂️ Project Structure

```
attendiq/
├── pages/
│   ├── index.js              → Redirects to /admin or /login
│   ├── login.js              → Admin login & register
│   ├── admin.js              → Admin dashboard (sessions + records)
│   ├── attend.js             → Student form (opened when QR is scanned)
│   └── api/
│       ├── auth/
│       │   ├── login.js      → POST /api/auth/login
│       │   ├── register.js   → POST /api/auth/register
│       │   ├── logout.js     → POST /api/auth/logout
│       │   └── me.js         → GET  /api/auth/me
│       ├── sessions/
│       │   ├── index.js      → GET/POST /api/sessions
│       │   └── [id].js       → GET/DELETE /api/sessions/:id
│       └── records/
│           ├── index.js      → GET /api/records
│           └── mark.js       → POST /api/records/mark
├── lib/
│   ├── db.js                 → Neon PostgreSQL connection + schema
│   ├── db-init.js            → Run once to create tables
│   ├── auth.js               → JWT helpers
│   └── geo.js                → Haversine distance formula
├── styles/
│   └── global.css
├── .env.local                → Your secrets (never commit this)
├── vercel.json
└── package.json
```

---

## 🚀 STEP-BY-STEP DEPLOYMENT

### STEP 1 — Create Neon Database (Free)

1. Go to **https://neon.tech** and sign up (free)
2. Click **"New Project"**
3. Give it a name: `attendiq`
4. Select region closest to you
5. Click **"Create Project"**
6. Copy the **Connection String** — it looks like:
   ```
   postgresql://user:pass@ep-cool-name-123.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

---

### STEP 2 — Push Code to GitHub

1. Go to **https://github.com** → **New repository**
2. Name it `attendiq`, make it **Public** or Private
3. Click **"Create repository"**
4. In your terminal, from the `attendiq/` folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/attendiq.git
   git push -u origin main
   ```

---

### STEP 3 — Deploy to Vercel

1. Go to **https://vercel.com** → Sign up with GitHub
2. Click **"Add New Project"**
3. Import your `attendiq` repository
4. Under **"Environment Variables"**, add these two:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Your Neon connection string from Step 1 |
   | `JWT_SECRET` | Any long random string (e.g. `my-super-secret-key-2024-attendiq`) |

5. Click **"Deploy"**
6. Wait ~1 minute — Vercel builds and deploys
7. Your app is live at: `https://attendiq.vercel.app` (or similar)

---

### STEP 4 — Initialize the Database

Run this **once** to create the tables:

```bash
# In the attendiq/ folder on your computer
DATABASE_URL="your_neon_connection_string" node lib/db-init.js
```

You should see: `✅ Database tables created successfully!`

---

### STEP 5 — Use the App

1. Open your Vercel URL: `https://your-app.vercel.app`
2. Click **Register** → create your admin account
3. Go to **Admin → Session Manager**
4. Fill in subject, location, GPS coordinates → click **Generate QR**
5. Download or display the QR on projector
6. Students scan with phone camera → form opens → they fill details → GPS verified → Present/Absent saved to database
7. View all records in **Records** tab → export CSV

---

## 🛢️ Database Tables

```sql
admins      → id, username, password (hashed), college, created_at
sessions    → id, admin_id, subject, section, location, lat, lng, radius, date, time_slot, expires_at, created_at
attendance  → id, session_id, name, roll, reg_no, department, year, status, distance, accuracy, lat, lng, marked_at
```

---

## 🔐 Security

- Passwords hashed with **bcryptjs** (10 salt rounds)
- Auth via **HTTP-only JWT cookie** (not accessible by JS)
- Each admin only sees their own sessions/records
- Students cannot access admin APIs
- Session expiry enforced server-side

---

## 🌐 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (React) |
| Backend | Next.js API Routes (serverless) |
| Database | PostgreSQL via Neon (serverless) |
| Auth | JWT + HTTP-only cookies |
| Hosting | Vercel |
| GPS | Browser Geolocation API |
| Distance | Haversine Formula |
| QR | `qrcode` npm package |

---

## 📱 How QR Scanning Works

1. Admin generates QR → it encodes the URL:
   `https://your-app.vercel.app/attend?s=SESSION_ID`
2. Student scans with phone camera → browser opens that URL
3. `/attend` page calls `GET /api/sessions/SESSION_ID` → gets session info
4. Student fills Name, Roll No., Department, Year → taps Submit
5. GPS permission requested → coordinates sent to `POST /api/records/mark`
6. Server calculates distance using Haversine formula
7. If distance ≤ radius → **Present** | else → **Absent**
8. Record saved to PostgreSQL with timestamp

---

## 🆘 Troubleshooting

**"Session not found"** → Check that DATABASE_URL is set in Vercel environment variables

**"GPS error"** → Student must allow location. HTTPS is required (Vercel provides this automatically)

**Build fails on Vercel** → Check that all environment variables are set

**Tables don't exist** → Run `node lib/db-init.js` with your DATABASE_URL
