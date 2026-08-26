# Walkthrough - AstroVedham Phase 1 (Complete)

Phase 1 of the AstroVedham administrative system is now implemented. This includes a robust Node.js backend and a modern React-based Admin Panel.

## Changes Made

### 1. Administrative Backend (`astrovedham_backend/`)
- **API Core:** Built with Express and TypeScript.
- **Database:** PostgreSQL integrated via Prisma ORM.
- **Security:**
    - Password hashing with `bcrypt`.
    - Session management using `JWT`.
    - Protected administrative routes.
    - Rate limiting on login attempts.
- **Order Management:**
    - Unique Order Number generator (`AV-YYYYMMDD-XXXXXX`).
    - Multer-based PDF report upload.
    - Lifecycle states: `PENDING` -> `SUCCESS` or `CANCELLED`.
- **Environment:** Comprehensive `.env` and `README.md` for setup.

### 2. Admin Panel (`astrovedham_admin/`)
- **Framework:** React + Vite + TypeScript + Tailwind CSS.
- **UI Design:** Professional administrative interface using AstroVedham brand colors (`#2E7D32`).
- **Pages:**
    - **Login:** Secure access to the panel.
    - **Dashboard:** At-a-glance stats for total, pending, successful, and cancelled orders.
    - **Order List:** Advanced filtering by status, search by order number/customer name, and pagination.
    - **Order Details:** Detailed view of customer inputs, PDF report uploader, and order cancellation.

## Verification Results

### Backend Health Check
- `GET /api/v1/health` -> `{"success":true,"message":"AstroVedham backend is running"}`

### Database Schema
- Verified `Admin`, `Customer`, and `Order` models are correctly defined.
- `Order` model includes unique sequence logic for `orderNumber`.

### UI Components
- Integrated `lucide-react` for iconography.
- Implemented responsive sidebar and layout.
- Connected to backend via Axios with interceptors for auth headers.

## Deployment & Testing Guide

### Step 1: PostgreSQL Setup
1. Create a database named `astrovedham` in your PostgreSQL instance.
2. Update `DATABASE_URL` in `astrovedham_backend/.env`.

### Step 2: Backend Launch
```bash
cd astrovedham_backend
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

### Step 3: Admin Panel Launch
```bash
cd astrovedham_admin
npm install
npm run dev
```

### Step 4: Verification Flow
1. Open `http://localhost:5173/login`.
2. Login with credentials set in your `.env` (default: `admin@astrovedham.com`).
3. Create a test order via the customer API:
   ```bash
   curl -X POST http://localhost:3000/api/v1/orders \
   -H "Content-Type: application/json" \
   -d '{
     "customer": {"name": "John Doe", "phone": "9876543210", "email": "john@example.com"},
     "horoscopeType": "life_horoscope",
     "horoscopeTitle": "Full Life Prediction",
     "inputDetails": {"dob": "1990-01-01", "tob": "10:00 AM", "pob": "Chennai"},
     "amount": 499
   }'
   ```
4. Verify the order appears as **PENDING** in the Admin Dashboard.
5. Upload a PDF report in the Order Details page.
6. Verify status changes to **SUCCESS**.
7. Test the **Cancel** button on a new pending order.
