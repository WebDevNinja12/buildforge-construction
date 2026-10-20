import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@buildforge.com" },
    update: {},
    create: {
      email: "admin@buildforge.com",
      password: adminPassword,
      name: "Admin User",
      role: "ADMIN",
      phone: "+1234567890",
    },
  });

  const clientPassword = await bcrypt.hash("client123", 12);
  await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: {},
    create: {
      email: "client@example.com",
      password: clientPassword,
      name: "Demo Client",
      role: "CLIENT",
      phone: "+1987654321",
    },
  });

  const assets = [
    {
      title: "Modern 4-Bedroom Villa",
      description: "Spacious family villa with modern finishes, garden, and double garage. Ready for occupation.",
      type: "HOUSE",
      price: 285000,
      location: "Green Hills Estate, Accra",
      size: "3200 sqft",
      bedrooms: 4,
      bathrooms: 3,
      images: JSON.stringify([]),
      features: JSON.stringify(["Garden", "Garage", "Security", "Water tank"]),
      status: "AVAILABLE",
    },
    {
      title: "Boutique Hotel – 24 Rooms",
      description: "Fully operational boutique hotel with restaurant, pool, and conference hall. Strong occupancy history.",
      type: "HOTEL",
      price: 1250000,
      location: "Beach Road, Cape Coast",
      size: "18000 sqft",
      bedrooms: 24,
      bathrooms: 28,
      images: JSON.stringify([]),
      features: JSON.stringify(["Pool", "Restaurant", "Conference", "Parking"]),
      status: "AVAILABLE",
    },
    {
      title: "2-Bedroom Apartment",
      description: "Newly built apartment in a gated community with 24/7 security and backup power.",
      type: "APARTMENT",
      price: 95000,
      location: "East Legon, Accra",
      size: "1100 sqft",
      bedrooms: 2,
      bathrooms: 2,
      images: JSON.stringify([]),
      features: JSON.stringify(["Gated", "Backup power", "Parking"]),
      status: "AVAILABLE",
    },
    {
      title: "Commercial Shop Unit",
      description: "Ground-floor retail unit on a busy commercial street. Ideal for retail or office.",
      type: "COMMERCIAL",
      price: 175000,
      location: "High Street, Kumasi",
      size: "800 sqft",
      images: JSON.stringify([]),
      features: JSON.stringify(["Street frontage", "Storage"]),
      status: "AVAILABLE",
    },
    {
      title: "Residential Plot – 0.5 Acre",
      description: "Prime residential plot in a developing estate. Clear title, ready for building.",
      type: "LAND",
      price: 45000,
      location: "Achimota Extension, Accra",
      size: "0.5 acres",
      images: JSON.stringify([]),
      features: JSON.stringify(["Clear title", "Road access", "Utilities nearby"]),
      status: "AVAILABLE",
    },
    {
      title: "Commercial Land – 2 Acres",
      description: "Large commercial plot suitable for warehouse, factory, or mixed-use development.",
      type: "LAND",
      price: 220000,
      location: "Tema Industrial Area",
      size: "2 acres",
      images: JSON.stringify([]),
      features: JSON.stringify(["Industrial zoning", "Highway access"]),
      status: "AVAILABLE",
    },
  ];

  for (const a of assets) {
    await prisma.asset.create({ data: a });
  }

  const tools = [
    { name: "Concrete Mixer 350L", description: "Heavy-duty electric concrete mixer for medium sites.", category: "HEAVY", dailyRate: 45, weeklyRate: 250, quantity: 5, available: 5 },
    { name: "Angle Grinder 9-inch", description: "Professional angle grinder for cutting and grinding.", category: "POWER", dailyRate: 15, weeklyRate: 80, quantity: 12, available: 12 },
    { name: "Scaffolding Set (10m)", description: "Complete scaffolding system for up to 10m height.", category: "HEAVY", dailyRate: 80, weeklyRate: 450, quantity: 3, available: 3 },
    { name: "Cordless Drill Kit", description: "18V cordless drill with 2 batteries and charger.", category: "POWER", dailyRate: 12, weeklyRate: 60, quantity: 20, available: 20 },
    { name: "Safety Harness Set", description: "Full body harness with lanyard for working at height.", category: "SAFETY", dailyRate: 8, weeklyRate: 40, quantity: 30, available: 30 },
    { name: "Spirit Level & Measuring Set", description: "Professional spirit levels, tape measures and squares.", category: "HAND", dailyRate: 5, weeklyRate: 25, quantity: 15, available: 15 },
    { name: "Mini Excavator (1.5T)", description: "Compact excavator for foundation and landscaping work.", category: "HEAVY", dailyRate: 220, weeklyRate: 1200, quantity: 2, available: 2 },
  ];

  for (const t of tools) {
    await prisma.tool.create({ data: t });
  }

  const workers = [
    { name: "Kwame Asante", specialty: "MASON", experience: 12, dailyRate: 55, rating: 4.8, bio: "Experienced bricklayer and block work specialist. Works with residential and commercial projects." },
    { name: "Ibrahim Sule", specialty: "ELECTRICIAN", experience: 9, dailyRate: 65, rating: 4.9, bio: "Licensed electrician. House wiring, industrial panels, and solar installations." },
    { name: "Grace Owusu", specialty: "PLUMBER", experience: 7, dailyRate: 50, rating: 4.7, bio: "Plumbing and sanitation systems for residential and small commercial buildings." },
    { name: "Daniel Boateng", specialty: "CARPENTER", experience: 15, dailyRate: 60, rating: 4.8, bio: "Formwork, roofing, and custom joinery. Team lead for larger carpentry crews." },
    { name: "Samuel Tetteh", specialty: "GENERAL", experience: 5, dailyRate: 35, rating: 4.5, bio: "Reliable general labour for site clearing, material handling, and assisting trades." },
    { name: "Patricia Mensah", specialty: "SUPERVISOR", experience: 18, dailyRate: 95, rating: 4.9, bio: "Site supervisor with strong safety and schedule management background." },
  ];

  for (const w of workers) {
    await prisma.worker.create({ data: w });
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
