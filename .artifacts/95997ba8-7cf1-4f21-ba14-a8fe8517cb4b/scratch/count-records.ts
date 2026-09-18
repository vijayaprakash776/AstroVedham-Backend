import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Record Audit ---');

  const adminCount = await prisma.admin.count();
  const serviceCount = await prisma.service.count();
  const customerCount = await prisma.customer.count();
  const orderCount = await prisma.order.count();

  console.log(`Admin records: ${adminCount}`);
  console.log(`Service records: ${serviceCount}`);
  console.log(`Customer records: ${customerCount}`);
  console.log(`Order records: ${orderCount}`);

  if (orderCount > 0) {
      const ordersWithPdf = await prisma.order.count({
          where: {
              pdfPath: {
                  not: null
              }
          }
      });
      console.log(`Orders with PDF paths: ${ordersWithPdf}`);
  }

  console.log('--- End Audit ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
