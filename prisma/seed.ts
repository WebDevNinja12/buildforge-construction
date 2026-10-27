import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const WORKER_IMAGES = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
];

async function main() {
  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@buildforge.com" },
    update: { status: "APPROVED", verificationStatus: "VERIFIED", approvedAt: new Date(), verifiedAt: new Date() },
    create: {
      email: "admin@buildforge.com",
      password: adminPassword,
      name: "Admin User",
      role: "ADMIN",
      phone: "+1234567890",
      status: "APPROVED",
      verificationStatus: "VERIFIED",
      approvedAt: new Date(),
      verifiedAt: new Date(),
    },
  });

  const clientPassword = await bcrypt.hash("client123", 12);
  await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: { status: "APPROVED", verificationStatus: "VERIFIED", approvedAt: new Date(), verifiedAt: new Date() },
    create: {
      email: "client@example.com",
      password: clientPassword,
      name: "Demo Client",
      role: "CLIENT",
      phone: "+1987654321",
      status: "APPROVED",
      verificationStatus: "VERIFIED",
      approvedAt: new Date(),
      verifiedAt: new Date(),
      agreedTermsAt: new Date(),
    },
  });

  // Category defaults
  const cats = [
    { category: "HOUSE", name: "House / Building", defaultExpiryHours: 336, installmentPlanMonths: 6, cancelDeductionPercent: 0, graceHours: 24, continuesAfterHold: true, sortOrder: 1,
      installmentRulesText: "Installment continues after the reservation hold. Pay first deposit before hold expires. Plan deadline is set by admin (e.g. 6 months)." },
    { category: "HOTEL", name: "Hotel", defaultExpiryHours: 168, installmentPlanMonths: null, cancelDeductionPercent: 20, graceHours: 24, continuesAfterHold: false, sortOrder: 2,
      installmentRulesText: "Installments must finish within the reservation period. Unpaid balance triggers grace then refund minus 20%." },
    { category: "LAND", name: "Land", defaultExpiryHours: 120, installmentPlanMonths: 12, cancelDeductionPercent: 0, graceHours: 24, continuesAfterHold: true, sortOrder: 3,
      installmentRulesText: "Installment continues after hold. Plan up to 12 months after first deposit." },
    { category: "TOOLS", name: "Tools", defaultExpiryHours: 48, installmentPlanMonths: null, cancelDeductionPercent: 15, graceHours: 12, continuesAfterHold: false, sortOrder: 4,
      installmentRulesText: "Must complete within reservation period. Grace then 15% deduction on refund." },
    { category: "WORKERS", name: "Workers", defaultExpiryHours: 12, installmentPlanMonths: null, cancelDeductionPercent: 10, graceHours: 6, continuesAfterHold: false, sortOrder: 5,
      installmentRulesText: "Must complete within reservation period. Grace then 10% deduction on refund." },
  ];
  for (const c of cats) {
    await prisma.categoryDefault.upsert({ where: { category: c.category }, create: c, update: c });
  }

  // Sample required docs for HOUSE
  await prisma.requiredDocumentType.upsert({
    where: { category_key: { category: "HOUSE", key: "id_card" } },
    create: { category: "HOUSE", key: "id_card", label: "Valid ID", description: "National ID or passport", required: true, sortOrder: 1 },
    update: {},
  }).catch(() => null);
  await prisma.requiredDocumentType.upsert({
    where: { category_key: { category: "HOUSE", key: "proof_income" } },
    create: { category: "HOUSE", key: "proof_income", label: "Proof of income", description: "Payslip or bank statement", required: true, sortOrder: 2 },
    update: {},
  }).catch(() => null);
  await prisma.requiredDocumentType.upsert({
    where: { category_key: { category: "LAND", key: "id_card" } },
    create: { category: "LAND", key: "id_card", label: "Valid ID", required: true, sortOrder: 1 },
    update: {},
  }).catch(() => null);

  const assetCount = await prisma.asset.count();
  if (assetCount === 0) {
    const assets = [
      { title: "Modern 4-Bedroom Villa", description: "Spacious family villa with modern finishes, garden, and double garage.", type: "HOUSE", price: 285000, location: "Green Hills Estate, Accra", size: "3200 sqft", bedrooms: 4, bathrooms: 3, images: JSON.stringify(["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"]), features: JSON.stringify(["Garden", "Garage"]), status: "AVAILABLE" },
      { title: "Boutique Hotel – 24 Rooms", description: "Fully operational boutique hotel with restaurant and pool.", type: "HOTEL", price: 1250000, location: "Beach Road, Cape Coast", size: "18000 sqft", bedrooms: 24, bathrooms: 28, images: JSON.stringify(["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"]), features: JSON.stringify(["Pool", "Restaurant"]), status: "AVAILABLE" },
      { title: "2-Bedroom Apartment", description: "Newly built apartment in a gated community.", type: "APARTMENT", price: 95000, location: "East Legon, Accra", size: "1100 sqft", bedrooms: 2, bathrooms: 2, images: JSON.stringify(["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"]), features: JSON.stringify(["Gated"]), status: "AVAILABLE" },
      { title: "Residential Plot – 0.5 Acre", description: "Prime residential plot. Clear title, ready for building.", type: "LAND", price: 45000, location: "Achimota Extension, Accra", size: "0.5 acres", images: JSON.stringify(["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800"]), features: JSON.stringify(["Clear title"]), status: "AVAILABLE" },
      { title: "Commercial Land – 2 Acres", description: "Large commercial plot for warehouse or mixed-use.", type: "LAND", price: 220000, location: "Tema Industrial Area", size: "2 acres", images: JSON.stringify(["https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800"]), features: JSON.stringify(["Industrial zoning"]), status: "AVAILABLE" },
    ];
    for (const a of assets) await prisma.asset.create({ data: a });
  }

  const toolCount = await prisma.tool.count();
  if (toolCount === 0) {
    const tools = [
      { name: "Concrete Mixer 350L", description: "Heavy-duty electric concrete mixer.", category: "HEAVY", dailyRate: 45, weeklyRate: 250, quantity: 5, available: 5, image: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400" },
      { name: "Angle Grinder 9-inch", description: "Professional angle grinder.", category: "POWER", dailyRate: 15, weeklyRate: 80, quantity: 12, available: 12, image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400" },
      { name: "Scaffolding Set (10m)", description: "Complete scaffolding system.", category: "HEAVY", dailyRate: 80, weeklyRate: 450, quantity: 3, available: 3 },
      { name: "Cordless Drill Kit", description: "18V cordless drill with batteries.", category: "POWER", dailyRate: 12, weeklyRate: 60, quantity: 20, available: 20 },
    ];
    for (const t of tools) await prisma.tool.create({ data: t });
  }

  const workerCount = await prisma.worker.count();
  if (workerCount === 0) {
    const workers = [
      { name: "Kwame Asante", specialty: "MASON", experience: 12, dailyRate: 55, rating: 4.8, bio: "Experienced bricklayer and block work specialist.", location: "Accra", image: WORKER_IMAGES[0], skills: JSON.stringify(["Block work", "Plastering", "Tiling"]), gallery: JSON.stringify([WORKER_IMAGES[0]]) },
      { name: "Ibrahim Sule", specialty: "ELECTRICIAN", experience: 9, dailyRate: 65, rating: 4.9, bio: "Licensed electrician. House wiring and solar.", location: "Kumasi", image: WORKER_IMAGES[1], skills: JSON.stringify(["Wiring", "Solar", "Panels"]), gallery: JSON.stringify([WORKER_IMAGES[1]]) },
      { name: "Grace Owusu", specialty: "PLUMBER", experience: 7, dailyRate: 50, rating: 4.7, bio: "Plumbing and sanitation systems.", location: "Tema", image: WORKER_IMAGES[2], skills: JSON.stringify(["Pipes", "Drainage"]), gallery: JSON.stringify([WORKER_IMAGES[2]]) },
      { name: "Daniel Boateng", specialty: "CARPENTER", experience: 15, dailyRate: 60, rating: 4.8, bio: "Formwork, roofing, and custom joinery.", location: "Cape Coast", image: WORKER_IMAGES[3], skills: JSON.stringify(["Formwork", "Roofing"]), gallery: JSON.stringify([WORKER_IMAGES[3]]) },
      { name: "Samuel Tetteh", specialty: "GENERAL", experience: 5, dailyRate: 35, rating: 4.5, bio: "Reliable general labour.", location: "Accra", image: WORKER_IMAGES[4], skills: JSON.stringify(["Labour", "Site clearing"]), gallery: JSON.stringify([WORKER_IMAGES[4]]) },
      { name: "Patricia Mensah", specialty: "SUPERVISOR", experience: 18, dailyRate: 95, rating: 4.9, bio: "Site supervisor with strong safety background.", location: "Accra", image: WORKER_IMAGES[5], skills: JSON.stringify(["Supervision", "Safety", "Scheduling"]), gallery: JSON.stringify([WORKER_IMAGES[5]]) },
    ];
    for (const w of workers) await prisma.worker.create({ data: w });
  } else {
    // Backfill images if missing
    const without = await prisma.worker.findMany({ where: { OR: [{ image: null }, { image: "" }] } });
    for (let i = 0; i < without.length; i++) {
      await prisma.worker.update({
        where: { id: without[i].id },
        data: {
          image: WORKER_IMAGES[i % WORKER_IMAGES.length],
          location: without[i].location || "Accra",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("Admin: admin@buildforge.com / admin123");
  console.log("Client: client@example.com / client123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
