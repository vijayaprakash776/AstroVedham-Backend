import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sampleOrder = await prisma.order.findFirst({
    where: {
      pdfPath: {
        not: null
      }
    },
    select: {
      pdfPath: true
    }
  });

  console.log('Sample pdfPath from DB:', sampleOrder?.pdfPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
