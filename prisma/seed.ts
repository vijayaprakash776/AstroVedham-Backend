import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  const existingAdmin = await prisma.admin.findUnique({
    where: { email }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: {
        name: 'Super Admin',
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
      },
    });
    console.log('Admin seeded successfully:', admin.email);
  } else {
    console.log('Admin already exists. Skipping admin creation.');
  }

  // Seed Approved Services Catalog
  const approvedServices = [
    { slug: 'life_horoscope', title: 'Life Horoscope', price: 1500.00 },
    { slug: 'super_life_horoscope', title: 'Super Life Horoscope', price: 3000.00 },
    { slug: 'marriage_horoscope', title: 'Marriage Horoscope', price: 1500.00 },
    { slug: 'marriage_compatibility', title: 'Marriage Compatibility', price: 1000.00 },
    { slug: 'complete_marriage_compatibility', title: 'Complete Marriage Compatibility', price: 2500.00 },
    { slug: 'single_page_horoscope', title: 'Single Page Horoscope', price: 500.00 },
    { slug: 'wealth_horoscope', title: 'Wealth Horoscope', price: 1200.00 },
    { slug: 'yearly_prediction', title: 'Yearly Prediction', price: 1000.00 },
    { slug: 'gemstones_horoscope', title: 'Gemstones Horoscope', price: 800.00 },
    { slug: 'numerology', title: 'Numerology', price: 999.00 },
    { slug: 'astrologer_consultation', title: 'Astrologer Consultation', price: 500.00 }
  ];

  for (const svc of approvedServices) {
    await prisma.service.upsert({
      where: { slug: svc.slug },
      update: { title: svc.title, price: svc.price },
      create: {
        slug: svc.slug,
        title: svc.title,
        price: svc.price,
        active: true
      }
    });
  }
  console.log('Services catalog seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
