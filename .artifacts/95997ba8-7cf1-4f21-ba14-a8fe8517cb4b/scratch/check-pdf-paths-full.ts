import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      pdfPath: {
        not: null
      }
    },
    select: {
      pdfPath: true
    }
  });

  console.log('PDF Paths:');
  orders.forEach(o => console.log(o.pdfPath));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
