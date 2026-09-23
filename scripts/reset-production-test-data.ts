import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Required 11 Approved Services Catalog Slugs
const EXPECTED_SERVICE_SLUGS = [
  'astrologer_consultation',
  'life_horoscope',
  'super_life_horoscope',
  'marriage_horoscope',
  'marriage_compatibility',
  'complete_marriage_compatibility',
  'single_page_horoscope',
  'wealth_horoscope',
  'yearly_prediction',
  'gemstones_horoscope',
  'numerology'
];

/**
 * Safely parses host and database name from connection string without exposing credentials.
 */
function getSafeDbInfo(connectionString?: string): { host: string; database: string } {
  if (!connectionString) {
    return { host: 'unknown', database: 'unknown' };
  }
  try {
    const parsed = new URL(connectionString);
    return {
      host: parsed.hostname || 'unknown',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'unknown'
    };
  } catch (e) {
    // Fallback simple parsing if URL parsing fails
    try {
      const parts = connectionString.split('@');
      if (parts.length > 1) {
        const hostDb = parts[1].split('/')[0];
        const db = parts[1].split('/')[1]?.split('?')[0] || 'unknown';
        return { host: hostDb, database: db };
      }
    } catch (err) {}
    return { host: 'parse-error', database: 'parse-error' };
  }
}

async function main() {
  console.log('================================================================');
  console.log('       ASTROVEDHAM PRODUCTION DATABASE RESET SCRIPT           ');
  console.log('================================================================');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('\nERROR: DATABASE_URL environment variable is missing.');
    console.error('Script aborted. No changes made.\n');
    process.exit(1);
  }

  const safeDbInfo = getSafeDbInfo(dbUrl);
  console.log(`Target Database Host: ${safeDbInfo.host}`);
  console.log(`Target Database Name: ${safeDbInfo.database}`);
  console.log(`Node Environment:     ${process.env.NODE_ENV || 'development'}`);
  console.log('----------------------------------------------------------------');

  // 1. Safety confirmation check
  const confirmation = process.env.RESET_ASTROVEDHAM_PRODUCTION;
  if (confirmation !== 'true') {
    console.log('\nWARNING: This will permanently delete customer/test data from the AstroVedham production PostgreSQL database.');
    console.error('\nProduction reset blocked. Set RESET_ASTROVEDHAM_PRODUCTION=true to continue.\n');
    process.exit(1);
  }

  console.log('\nSafety confirmation verified (RESET_ASTROVEDHAM_PRODUCTION=true).');
  console.log('Connecting to database and performing pre-reset audit...\n');

  // 2. Audit before reset
  let beforeCustomers = 0;
  let beforeOrders = 0;
  let beforeOtpRecords = 0;
  let beforeOrdersWithPdf = 0;
  let beforeAdmins = 0;
  let beforeServices = 0;

  try {
    [
      beforeCustomers,
      beforeOrders,
      beforeOtpRecords,
      beforeOrdersWithPdf,
      beforeAdmins,
      beforeServices
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.order.count(),
      prisma.customer.count({ where: { otpHash: { not: null } } }),
      prisma.order.count({ where: { pdfPath: { not: null } } }),
      prisma.admin.count(),
      prisma.service.count()
    ]);
  } catch (error: any) {
    console.error('\nFAILED to query database before reset:', error?.message || error);
    console.error('Script aborted. No changes made.\n');
    process.exit(1);
  }

  console.log('================================================================');
  console.log('                      BEFORE RESET AUDIT                        ');
  console.log('================================================================');
  console.log(`DATA TO BE DELETED:`);
  console.log(`  - Customers / Test Users: ${beforeCustomers}`);
  console.log(`  - Orders:                 ${beforeOrders}`);
  console.log(`  - OTP / Auth Records:     ${beforeOtpRecords}`);
  console.log(`  - Orders with PDF Reports:${beforeOrdersWithPdf}`);
  console.log(`\nPRESERVED DATA:`);
  console.log(`  - Admins:                 ${beforeAdmins}`);
  console.log(`  - Services Catalog:       ${beforeServices}`);
  console.log('================================================================\n');

  // 3. Collect linked PDF report paths
  const ordersWithPdfs = await prisma.order.findMany({
    where: { pdfPath: { not: null } },
    select: { pdfPath: true }
  });

  const pdfFilesToDelete = ordersWithPdfs
    .map(o => o.pdfPath)
    .filter((p): p is string => !!p);

  console.log(`Found ${pdfFilesToDelete.length} PDF report references in database.`);

  // 4. Safely clean up local orphaned PDF files if they exist locally
  let deletedFilesCount = 0;
  let skippedFilesCount = 0;

  const uploadsDir = path.resolve(process.cwd(), 'uploads/horoscopes');

  for (const relativeOrAbsolutePath of pdfFilesToDelete) {
    try {
      const normalizedPath = relativeOrAbsolutePath.replace(/\\/g, '/');
      const resolvedPath = path.isAbsolute(normalizedPath)
        ? normalizedPath
        : path.resolve(process.cwd(), normalizedPath);

      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
        deletedFilesCount++;
      } else {
        // Check if file filename exists in uploadsDir
        const filename = path.basename(normalizedPath);
        const altPath = path.join(uploadsDir, filename);
        if (fs.existsSync(altPath)) {
          fs.unlinkSync(altPath);
          deletedFilesCount++;
        } else {
          skippedFilesCount++;
        }
      }
    } catch (err: any) {
      console.warn(`Could not delete PDF file (${relativeOrAbsolutePath}): ${err?.message}`);
      skippedFilesCount++;
    }
  }

  console.log(`PDF Storage Cleanup: Deleted ${deletedFilesCount} local files, ${skippedFilesCount} skipped/remote/not found.`);

  // 5. Execute targeted database transaction deletion
  console.log('\nExecuting targeted database reset transaction...');

  try {
    await prisma.$transaction(async (tx) => {
      // Step A: Delete all orders (child records of customer)
      const deletedOrders = await tx.order.deleteMany({});
      console.log(`  [TX] Deleted ${deletedOrders.count} order records.`);

      // Step B: Delete all customers
      const deletedCustomers = await tx.customer.deleteMany({});
      console.log(`  [TX] Deleted ${deletedCustomers.count} customer records.`);
    });

    console.log('\nDatabase reset transaction completed successfully.');
  } catch (error: any) {
    console.error('\nERROR: Reset transaction failed and was rolled back:', error?.message || error);
    process.exit(1);
  }

  // 6. Post-reset audit and verification
  const afterCustomers = await prisma.customer.count();
  const afterOrders = await prisma.order.count();
  const afterOtpRecords = await prisma.customer.count({ where: { otpHash: { not: null } } });
  const afterAdmins = await prisma.admin.count();
  const afterServices = await prisma.service.count();

  const servicesList = await prisma.service.findMany({
    select: { slug: true, title: true, active: true }
  });

  const existingSlugs = servicesList.map(s => s.slug);
  const missingSlugs = EXPECTED_SERVICE_SLUGS.filter(slug => !existingSlugs.includes(slug));

  const isCustomerCleared = afterCustomers === 0;
  const isOrdersCleared = afterOrders === 0;
  const isAdminPreserved = afterAdmins === beforeAdmins && afterAdmins >= 1;
  const isServicesPreserved = afterServices === 11 && missingSlugs.length === 0;

  console.log('\n================================================================');
  console.log('                      POST-RESET VERIFICATION                   ');
  console.log('================================================================');
  console.log(`Customer Records Remaining:  ${afterCustomers} (Expected: 0) -> ${isCustomerCleared ? 'PASS' : 'FAIL'}`);
  console.log(`Order Records Remaining:     ${afterOrders} (Expected: 0) -> ${isOrdersCleared ? 'PASS' : 'FAIL'}`);
  console.log(`OTP Records Remaining:       ${afterOtpRecords} (Expected: 0) -> ${afterOtpRecords === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`Admin Accounts Preserved:    ${afterAdmins} (Expected: ${beforeAdmins}) -> ${isAdminPreserved ? 'PASS' : 'FAIL'}`);
  console.log(`Service Catalog Preserved:   ${afterServices} (Expected: 11) -> ${isServicesPreserved ? 'PASS' : 'FAIL'}`);

  if (missingSlugs.length > 0) {
    console.warn(`WARNING: Missing service slugs in catalog: ${missingSlugs.join(', ')}`);
  }

  console.log('================================================================\n');

  if (isCustomerCleared && isOrdersCleared && isAdminPreserved && isServicesPreserved) {
    console.log('SUCCESS: AstroVedham production test data successfully reset.');
  } else {
    console.error('VERIFICATION FAILED: Some post-reset checks did not pass. Please review logs.');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('FATAL UNHANDLED ERROR during reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
