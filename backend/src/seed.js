require("dotenv/config");
const bcrypt = require("bcryptjs");
const prisma = require("./config/prisma");

async function main() {
  const hash = (p) => bcrypt.hash(p, 10);

  // ======== Admin ========
  let admin = await prisma.user.findUnique({ where: { email: "admin@talenthub.local" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        fullName: "مدير النظام",
        email: "admin@talenthub.local",
        passwordHash: await hash("Admin1234"),
        role: "ADMIN",
        status: "ACTIVE"
      }
    });
    console.log("✅ Admin: admin@talenthub.local / Admin1234");
  }

  // ======== Universities ========
  const uniEmails = [
    { email: "uni1@talenthub.local", name: "جامعة القاهرة",     location: "القاهرة" },
    { email: "uni2@talenthub.local", name: "جامعة الإسكندرية",  location: "الإسكندرية" },
    { email: "uni3@talenthub.local", name: "جامعة عين شمس",     location: "القاهرة" }
  ];
  const universities = [];
  for (const u of uniEmails) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { fullName: u.name, email: u.email, passwordHash: await hash("Uni12345"), role: "UNIVERSITY", status: "ACTIVE" }
      });
      await prisma.university.create({
        data: { userId: user.id, name: u.name, location: u.location, status: "ACTIVE" }
      });
      console.log(`✅ University: ${u.email} / Uni12345`);
    }
    universities.push(await prisma.university.findUnique({ where: { userId: user.id } }));
  }

  // ======== Companies ========
  const compEmails = [
    { email: "comp1@talenthub.local", name: "شركة التقنية المتقدمة", industry: "تكنولوجيا المعلومات" },
    { email: "comp2@talenthub.local", name: "مجموعة الأعمال العربية", industry: "التجارة الإلكترونية" },
    { email: "comp3@talenthub.local", name: "حلول البيانات الذكية",   industry: "الذكاء الاصطناعي" }
  ];
  const companies = [];
  for (const c of compEmails) {
    let user = await prisma.user.findUnique({ where: { email: c.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { fullName: c.name, email: c.email, passwordHash: await hash("Comp1234"), role: "COMPANY", status: "ACTIVE" }
      });
      await prisma.company.create({
        data: { userId: user.id, name: c.name, industry: c.industry, status: "ACTIVE" }
      });
      console.log(`✅ Company: ${c.email} / Comp1234`);
    }
    companies.push(await prisma.company.findUnique({ where: { userId: user.id } }));
  }

  // ======== Skills ========
  const skillNames = [
    { name: "JavaScript",    category: "برمجة" },
    { name: "Python",        category: "برمجة" },
    { name: "React",         category: "تطوير الويب" },
    { name: "Node.js",       category: "تطوير الويب" },
    { name: "SQL",           category: "قواعد البيانات" },
    { name: "Machine Learning", category: "ذكاء اصطناعي" },
    { name: "UI/UX Design",  category: "تصميم" },
    { name: "Project Management", category: "إدارة" }
  ];
  const skills = [];
  for (const s of skillNames) {
    const skill = await prisma.skill.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, category: s.category, status: "ACTIVE" }
    });
    skills.push(skill);
  }
  console.log(`✅ Skills: ${skills.length} مهارة`);

  // ======== Students ========
  const studentData = [
    { email: "student1@talenthub.local", name: "أحمد محمد علي",    uniIdx: 0 },
    { email: "student2@talenthub.local", name: "فاطمة حسن إبراهيم", uniIdx: 0 },
    { email: "student3@talenthub.local", name: "محمد خالد السيد",   uniIdx: 1 },
    { email: "student4@talenthub.local", name: "سارة أحمد محمود",   uniIdx: 1 },
    { email: "student5@talenthub.local", name: "علي عمر عبدالله",   uniIdx: 2 }
  ];
  const students = [];
  for (const s of studentData) {
    let user = await prisma.user.findUnique({ where: { email: s.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { fullName: s.name, email: s.email, passwordHash: await hash("Student1"), role: "STUDENT", status: "ACTIVE" }
      });
      const student = await prisma.student.create({
        data: {
          userId: user.id,
          universityId: universities[s.uniIdx]?.id || null,
          bio: `طالب متميز في مجال التكنولوجيا`,
          status: "ACTIVE"
        }
      });
      // Add 2 skills per student
      const idx = studentData.indexOf(s);
      for (const skillId of [skills[idx % skills.length].id, skills[(idx + 1) % skills.length].id]) {
        await prisma.studentSkill.upsert({
          where: { studentId_skillId: { studentId: student.id, skillId } },
          update: {},
          create: { studentId: student.id, skillId }
        });
      }
      students.push(student);
      console.log(`✅ Student: ${s.email} / Student1`);
    } else {
      const st = await prisma.student.findUnique({ where: { userId: user.id } });
      if (st) students.push(st);
    }
  }

  // ======== Jobs ========
  const jobTypes = ["FULL_TIME", "PART_TIME", "INTERNSHIP", "REMOTE"];
  const jobData = [
    { title: "مطور React Frontend",        location: "القاهرة",       type: "FULL_TIME",   compIdx: 0 },
    { title: "مطور Node.js Backend",       location: "الإسكندرية",    type: "FULL_TIME",   compIdx: 0 },
    { title: "محلل بيانات",                location: "عن بُعد",        type: "REMOTE",      compIdx: 1 },
    { title: "مصمم UI/UX",                 location: "القاهرة",       type: "PART_TIME",   compIdx: 1 },
    { title: "متدرب تطوير برمجيات",        location: "القاهرة",       type: "INTERNSHIP",  compIdx: 2 },
    { title: "مهندس Machine Learning",     location: "عن بُعد",        type: "REMOTE",      compIdx: 2 }
  ];
  const jobs = [];
  for (const j of jobData) {
    const existing = await prisma.job.findFirst({ where: { title: j.title, companyId: companies[j.compIdx]?.id } });
    if (!existing && companies[j.compIdx]) {
      const job = await prisma.job.create({
        data: {
          companyId: companies[j.compIdx].id,
          title: j.title,
          location: j.location,
          type: j.type,
          status: "OPEN",
          description: `وظيفة ${j.title} - نبحث عن مرشح متميز للانضمام إلى فريقنا.`
        }
      });
      // Add skill to job
      const skillIdx = jobData.indexOf(j) % skills.length;
      await prisma.jobSkill.create({
        data: { jobId: job.id, skillId: skills[skillIdx].id }
      }).catch(() => {});
      jobs.push(job);
    } else if (existing) {
      jobs.push(existing);
    }
  }
  console.log(`✅ Jobs: ${jobs.length} وظيفة`);

  // ======== Applications ========
  let appCount = 0;
  for (let i = 0; i < Math.min(students.length, jobs.length); i++) {
    const app = await prisma.application.upsert({
      where: { studentId_jobId: { studentId: students[i].id, jobId: jobs[i].id } },
      update: {},
      create: {
        studentId: students[i].id,
        jobId: jobs[i].id,
        status: ["PENDING", "ACCEPTED", "REJECTED"][i % 3]
      }
    });
    appCount++;
  }
  console.log(`✅ Applications: ${appCount} طلب توظيف`);

  console.log("\n========================================");
  console.log("  بيانات تسجيل الدخول:");
  console.log("  Admin:    admin@talenthub.local / Admin1234");
  console.log("  Student:  student1@talenthub.local / Student1");
  console.log("  Company:  comp1@talenthub.local / Comp1234");
  console.log("  Uni:      uni1@talenthub.local / Uni12345");
  console.log("========================================\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

