# Implementation Plan - AstroVedham Phase 1 (Backend & Admin)

This plan covers the development of the standalone administrative backend and the React-based admin panel for horoscope order management.

## User Review Required

> [!IMPORTANT]
> - **Backend Port:** 3000
> - **Admin Port:** 5173 (Vite default)
> - **Database:** PostgreSQL named `astrovedham` (needs to be created manually or via prisma migrate).
> - **Security:** Admin passwords will be hashed with bcrypt. JWT will be used for session management.
> - **File Storage:** Multer will store PDF reports in `uploads/horoscopes/`.

> [!CAUTION]
> The seed script will use environment variables `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Ensure these are set in your `.env` before running the seed.

## Proposed Changes

### [Component] AstroVedham Backend (`astrovedham_backend/`)

#### [MODIFY] [schema.prisma](file:///D:/Flutter_SDK/astrovedham_backend/prisma/schema.prisma)
Update models:
- `Admin`: `id`, `name`, `email`, `passwordHash`, `role`.
- `Customer`: `id`, `name`, `phone`, `email`.
- `Order`: `id`, `orderNumber` (unique), `customerId`, `horoscopeType`, `horoscopeTitle`, `inputDetails` (JSON), `amount`, `currency`, `status` (PENDING, SUCCESS, CANCELLED), `pdfPath`, `resultAvailable`, `createdAt`, `updatedAt`, `completedAt`, `cancelledAt`.

#### [NEW] [config/prisma.ts](file:///D:/Flutter_SDK/astrovedham_backend/src/config/prisma.ts)
Instantiate and export the Prisma client.

#### [NEW] [middleware/auth.ts](file:///D:/Flutter_SDK/astrovedham_backend/src/middleware/auth.ts)
Implement `requireAdminAuth` using JWT.

#### [NEW] [middleware/upload.ts](file:///D:/Flutter_SDK/astrovedham_backend/src/middleware/upload.ts)
Configure Multer for PDF-only uploads with size limits.

#### [NEW] [utils/order.ts](file:///D:/Flutter_SDK/astrovedham_backend/src/utils/order.ts)
Logic for unique order number generation (`AV-YYYYMMDD-XXXXXX`).

#### [NEW] Controllers & Routes
- **Admin Auth:** Login endpoint.
- **Admin Dashboard:** Stats (Total, Pending, Success, Cancelled).
- **Admin Orders:** List (filters/search/pagination), Details, Upload Report, Cancel.
- **Customer Order (Mock):** Create Order, Get Order.

#### [NEW] [prisma/seed.ts](file:///D:/Flutter_SDK/astrovedham_backend/prisma/seed.ts)
Development-only admin account creation.

---

### [Component] AstroVedham Admin Panel (`astrovedham_admin/`)

#### [NEW] Project Initialization
Create a Vite + React + TypeScript project.

#### [NEW] UI Framework
Setup a clean, professional design using the AstroVedham color palette:
- Primary Green: `#2E7D32`
- Dark Green: `#1B5E20`
- Light Green: `#E8F5E9`

#### [NEW] Pages & Features
- **Login:** Admin authentication and JWT storage.
- **Dashboard:** Summary statistics.
- **Orders List:** Filtered by status, horoscope type, search functionality.
- **Order Details:** Customer info, inputs, upload PDF field for PENDING orders, view/download for SUCCESS orders.
- **State Management:** Simple hooks/context for auth and API data.

---

## Verification Plan

### Automated Tests
- `npm run prisma:generate` & `npm run prisma:migrate`
- `npm run test` (if applicable) or manual API testing via Postman/cURL.

### Manual Verification
1. **Health Check:** `GET /api/v1/health`.
2. **Admin Login:** Verify JWT issuance and rejection of invalid credentials.
3. **Order Flow:**
    - Create order via customer API.
    - Verify PENDING status in Admin.
    - Upload PDF -> Verify SUCCESS status and file existence.
    - Create another -> Cancel -> Verify CANCELLED status.
4. **UI Check:** Verify brand colors and responsive layout.
5. **Security:** Attempt to access admin APIs without a token.
