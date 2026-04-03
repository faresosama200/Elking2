require("dotenv/config");
const bcrypt = require("bcryptjs");
const prisma = require("./config/prisma");

async function main() {
  const adminEmail = "admin@talenthub.local";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log("Seed already exists");
    return;
  }

  const passwordHash = await bcrypt.hash("Admin1234", 10);
  await prisma.user.create({
    data: {
      fullName: "System Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE"
    }
  });

  console.log("Seed completed: admin@talenthub.local / Admin1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
