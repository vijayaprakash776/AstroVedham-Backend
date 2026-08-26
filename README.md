# AstroVedham Backend (Phase 1)

Administrative backend for AstroVedham horoscope order management.

## Tech Stack
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT & bcrypt for authentication
- Multer for PDF uploads

## Prerequisites
- Node.js (v18+)
- PostgreSQL

## Setup
1. Clone the repository.
2. Run `npm install`.
3. Create a `.env` file based on the template:
   ```env
   PORT=3000
   DATABASE_URL="postgresql://user:password@localhost:5432/astrovedham?schema=public"
   JWT_SECRET="your_secret"
   ADMIN_EMAIL="admin@astrovedham.com"
   ADMIN_PASSWORD="securepassword"
   ```
4. Run migrations: `npx prisma migrate dev --name init`.
5. Seed the admin account: `npm run prisma:seed`.
6. Start development server: `npm run dev`.

## API Endpoints
### Health
- `GET /api/v1/health`

### Admin Auth
- `POST /api/v1/admin/auth/login`

### Admin Protected
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/orders/:orderNumber`
- `POST /api/v1/admin/orders/:orderNumber/report` (PDF upload)
- `PATCH /api/v1/admin/orders/:orderNumber/cancel`

### Mock Customer
- `POST /api/v1/orders`
- `GET /api/v1/orders/:orderNumber`

## Order Lifecycle
1. **PENDING:** Created via Customer API.
2. **SUCCESS:** Admin uploads a PDF report.
3. **CANCELLED:** Admin manually cancels a PENDING order.

## Limitations
- Phase 1 does not include payment integration.
- Horoscope reports are prepared manually.
- No automatic horoscope generation.
