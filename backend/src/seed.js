require("dotenv/config");
const bcrypt = require("bcryptjs");
const prisma = require("./config/prisma");

async function main() {
  const hash = (p) => bcrypt.hash(p, 10);
  const ensureUser = async ({ fullName, email, password, role }) => {
    return prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        passwordHash: await hash(password),
        role,
        status: "ACTIVE"
      },
      create: {
        fullName,
        email,
        passwordHash: await hash(password),
        role,
        status: "ACTIVE"
      }
    });
  };

  // ======== Admin ========
  await ensureUser({
    fullName: "مدير النظام",
    email: "admin@talenthub.local",
    password: "Admin1234",
    role: "ADMIN"
  });
  console.log("✅ Admin: admin@talenthub.local / Admin1234");

  // ======== Universities ========
  const uniEmails = [
    { email: "uni1@talenthub.local", name: "جامعة القاهرة",     location: "القاهرة" },
    { email: "uni2@talenthub.local", name: "جامعة الإسكندرية",  location: "الإسكندرية" },
    { email: "uni3@talenthub.local", name: "جامعة عين شمس",     location: "القاهرة" }
  ];
  const universities = [];
  for (const u of uniEmails) {
    const user = await ensureUser({
      fullName: u.name,
      email: u.email,
      password: "Uni12345",
      role: "UNIVERSITY"
    });
    const university = await prisma.university.upsert({
      where: { userId: user.id },
      update: { name: u.name, location: u.location, status: "ACTIVE" },
      create: { userId: user.id, name: u.name, location: u.location, status: "ACTIVE" }
    });
    universities.push(university);
    console.log(`✅ University: ${u.email} / Uni12345`);
  }

  // ======== Companies ========
  const compEmails = [
    { email: "comp1@talenthub.local", name: "شركة التقنية المتقدمة", industry: "تكنولوجيا المعلومات" },
    { email: "comp2@talenthub.local", name: "مجموعة الأعمال العربية", industry: "التجارة الإلكترونية" },
    { email: "comp3@talenthub.local", name: "حلول البيانات الذكية",   industry: "الذكاء الاصطناعي" }
  ];
  const companies = [];
  for (const c of compEmails) {
    const user = await ensureUser({
      fullName: c.name,
      email: c.email,
      password: "Comp1234",
      role: "COMPANY"
    });
    const company = await prisma.company.upsert({
      where: { userId: user.id },
      update: { name: c.name, industry: c.industry, status: "ACTIVE" },
      create: { userId: user.id, name: c.name, industry: c.industry, status: "ACTIVE" }
    });
    companies.push(company);
    console.log(`✅ Company: ${c.email} / Comp1234`);
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
    const user = await ensureUser({
      fullName: s.name,
      email: s.email,
      password: "Student1",
      role: "STUDENT"
    });
    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        universityId: universities[s.uniIdx]?.id || null,
        bio: "طالب متميز في مجال التكنولوجيا",
        status: "ACTIVE"
      },
      create: {
        userId: user.id,
        universityId: universities[s.uniIdx]?.id || null,
        bio: "طالب متميز في مجال التكنولوجيا",
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

