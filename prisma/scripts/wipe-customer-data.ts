import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(process.cwd(), 'uploads/horoscopes');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isAuthorized = process.env.WIPE_CUSTOMER_DATA === 'true';

  console.log('========================================');
  console.log('ASTROVEDHAM CUSTOMER DATA WIPE');
  console.log('==============================');
  console.log(`Database URL: ${process.env.DATABASE_URL?.split('@')[1] || 'Unknown'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log('========================================\n');

  if (!isDryRun && !isAuthorized) {
    console.error('Customer data wipe NOT authorized. Set WIPE_CUSTOMER_DATA=true to execute.');
    process.exit(1);
  }

  // Audit Before
  const beforeAdmin = await prisma.admin.count();
  const beforeService = await prisma.service.count();
  const beforeCustomer = await prisma.customer.count();
  const beforeOrder = await prisma.order.count();

  const ordersWithPdf = await prisma.order.findMany({
      where: { pdfPath: { not: null } },
      select: { pdfPath: true }
  });

  // Extract filenames from paths (which might be absolute or relative)
  const pdfFilenames = ordersWithPdf.map(o => {
      if (!o.pdfPath) return null;
      return path.basename(o.pdfPath);
  }).filter((f): f is string => !!f);

  console.log('CURRENT COUNTS:');
  console.log(`- Admin (KEEP): ${beforeAdmin}`);
  console.log(`- Service (KEEP): ${beforeService}`);
  console.log(`- Customer (DELETE): ${beforeCustomer}`);
  console.log(`- Order (DELETE): ${beforeOrder}`);
  console.log(`- PDF Files linked in DB: ${pdfFilenames.length}\n`);

  if (isDryRun) {
    console.log('DRY RUN COMPLETE. No data was modified.');
    return;
  }

  console.log('Executing wipe...');

  try {
    // 1. Delete PDF Files first (while we have the names)
    let deletedFilesCount = 0;
    for (const filename of pdfFilenames) {
        const fullPath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            deletedFilesCount++;
        } else {
            console.warn(`- File not found locally: ${filename}`);
        }
    }
    console.log(`- Removed ${deletedFilesCount} PDF files.`);

    await prisma.$transaction(async (tx) => {
      // 2. Delete Orders
      const deletedOrders = await tx.order.deleteMany({});
      console.log(`- Deleted ${deletedOrders.count} orders.`);

      // 3. Delete Customers
      const deletedCustomers = await tx.customer.deleteMany({});
      console.log(`- Deleted ${deletedCustomers.count} customers.`);
    });

    console.log('\nWIPE SUCCESSFUL.\n');

    // Audit After
    const afterAdmin = await prisma.admin.count();
    const afterService = await prisma.service.count();
    const afterCustomer = await prisma.customer.count();
    const afterOrder = await prisma.order.count();

    console.log('POST-WIPE COUNTS:');
    console.log(`- Admin: ${afterAdmin} (${afterAdmin === beforeAdmin ? 'PASS' : 'FAIL'})`);
    console.log(`- Service: ${afterService} (${afterService === beforeService ? 'PASS' : 'FAIL'})`);
    console.log(`- Customer: ${afterCustomer} (${afterCustomer === 0 ? 'PASS' : 'FAIL'})`);
    console.log(`- Order: ${afterOrder} (${afterOrder === 0 ? 'PASS' : 'FAIL'})`);

  } catch (error) {
    console.error('WIPE FAILED:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
