# TODO LIST - ASTROVEDHAM SECURE BACKEND INTEGRATION

## Phase 1 — Database / Schema Changes
- [x] Add `Service` model to `prisma/schema.prisma`
- [x] Add `otpHash` and `otpExpiresAt` columns to `Customer` model
- [x] Add `serviceId` relationship field to `Order` model
- [x] Generate and run Prisma migrations via `npx prisma migrate dev`

## Phase 2 — Service Catalog Setup
- [x] Update `prisma/seed.ts` to insert the 11 approved service variants
- [x] Run database seeding using `npx prisma db seed`
- [x] Create `src/routes/serviceRoutes.ts` and `src/controllers/serviceController.ts`
- [x] Register service listing path in `src/app.ts`

## Phase 3 — Customer OTP Authentication
- [x] Implement `src/services/smsService.ts` with local fallback logging
- [x] Create `src/routes/authRoutes.ts` and `src/controllers/authController.ts` for sending/verifying passcodes
- [x] Mount customer authentication endpoints in `src/app.ts`

## Phase 4 — JWT Authorization Middleware
- [x] Implement customer authentication middleware `src/middleware/customerAuth.ts`
- [x] Mount security guard layer across customer order routes in `src/app.ts`

## Phase 5 — Order Security & IDOR Mitigation
- [x] Refactor `src/controllers/orderController.ts` to fetch customer identity context from tokens instead of query text parameters
- [x] Add cross-tenant scope lookups to enforce that users only fetch owned order details

## Phase 6 — Server-Side Order Pricing
- [x] Modify `POST /api/v1/orders` entry logic to look up authoritative item pricing from database records via service ID/slug parameters

## Phase 7 — Concurrency-Safe Order Numbers
- [x] Refactor `generateOrderNumber()` inside `src/utils/order.ts` using database-backed transactional loops or isolated locks to prevent duplicates

## Phase 8 — Admin API & Link Fixes
- [x] Update `OrderDetails.tsx` inside the admin portal to map file download links through global relative Axios config metrics instead of localhost string templates

## Phase 9 — PDF / Document Security
- [x] Secure `GET /api/v1/orders/:orderNumber/report` route handlers to confirm user ownership before streaming report files

## Phase 10 — Flutter Connection
- [x] Implement local JWT state persistence within `LocalStorageService`
- [x] Attach bearer interceptor routines onto `api_client.dart`
- [x] Re-wire payload maps inside `review_details_screen.dart` to submit product slugs

## Phase 11 — Testing & Verification
- [x] Execute automated safety scripts checking endpoint guard restrictions
- [x] Conduct end-to-end user flows verifying order placement, state transitions, and file downloads across clients
