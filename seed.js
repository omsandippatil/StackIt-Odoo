// createAdmin.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@gmail.com';
  const plainPassword = 'admin@123';

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    console.log(`User with email ${email} already exists.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created:', user);
}

main()
  .catch((e) => {
    console.error('❌ Error creating admin user:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
