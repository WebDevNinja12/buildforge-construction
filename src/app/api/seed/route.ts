import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-seed-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.JWT_SECRET && secret !== "buildforge-seed-once") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    const assetCount = await prisma.asset.count();
    if (assetCount === 0) {
      await prisma.asset.createMany({
        data: [
          {
            title: "Modern 4-Bedroom Villa",
            description: "Spacious family villa with modern finishes, garden, and double garage.",
            type: "HOUSE",
            price: 285000,
            location: "Green Hills Estate, Accra",
            size: "3200 sqft",
            bedrooms: 4,
            bathrooms: 3,
            images: "[]",
            features: JSON.stringify(["Garden", "Garage", "Security"]),
            status: "AVAILABLE",
          },
          {
            title: "Boutique Hotel – 24 Rooms",
            description: "Fully operational boutique hotel with restaurant and pool.",
            type: "HOTEL",
            price: 1250000,
            location: "Beach Road, Cape Coast",
            size: "18000 sqft",
            bedrooms: 24,
            bathrooms: 28,
            images: "[]",
            features: JSON.stringify(["Pool", "Restaurant", "Conference"]),
            status: "AVAILABLE",
          },
          {
            title: "2-Bedroom Apartment",
            description: "Newly built apartment in a gated community.",
            type: "APARTMENT",
            price: 95000,
            location: "East Legon, Accra",
            size: "1100 sqft",
            bedrooms: 2,
            bathrooms: 2,
            images: "[]",
            features: JSON.stringify(["Gated", "Backup power"]),
            status: "AVAILABLE",
          },
          {
            title: "Residential Plot – 0.5 Acre",
            description: "Prime residential plot with clear title.",
            type: "LAND",
            price: 45000,
            location: "Achimota Extension, Accra",
            size: "0.5 acres",
            images: "[]",
            features: JSON.stringify(["Clear title", "Road access"]),
            status: "AVAILABLE",
          },
          {
            title: "Commercial Land – 2 Acres",
            description: "Large commercial plot for warehouse or mixed-use.",
            type: "LAND",
            price: 220000,
            location: "Tema Industrial Area",
            size: "2 acres",
            images: "[]",
            features: JSON.stringify(["Industrial zoning"]),
            status: "AVAILABLE",
          },
        ],
      });
    }

    const toolCount = await prisma.tool.count();
    if (toolCount === 0) {
      await prisma.tool.createMany({
        data: [
          { name: "Concrete Mixer 350L", description: "Heavy-duty electric concrete mixer.", category: "HEAVY", dailyRate: 45, weeklyRate: 250, quantity: 5, available: 5 },
          { name: "Angle Grinder 9-inch", description: "Professional angle grinder.", category: "POWER", dailyRate: 15, weeklyRate: 80, quantity: 12, available: 12 },
          { name: "Scaffolding Set (10m)", description: "Complete scaffolding system.", category: "HEAVY", dailyRate: 80, weeklyRate: 450, quantity: 3, available: 3 },
          { name: "Cordless Drill Kit", description: "18V cordless drill with batteries.", category: "POWER", dailyRate: 12, weeklyRate: 60, quantity: 20, available: 20 },
          { name: "Mini Excavator (1.5T)", description: "Compact excavator for foundations.", category: "HEAVY", dailyRate: 220, weeklyRate: 1200, quantity: 2, available: 2 },
        ],
      });
    }

    const workerCount = await prisma.worker.count();
    if (workerCount === 0) {
      await prisma.worker.createMany({
        data: [
          { name: "Kwame Asante", specialty: "MASON", experience: 12, dailyRate: 55, rating: 4.8, bio: "Experienced bricklayer." },
          { name: "Ibrahim Sule", specialty: "ELECTRICIAN", experience: 9, dailyRate: 65, rating: 4.9, bio: "Licensed electrician." },
          { name: "Grace Owusu", specialty: "PLUMBER", experience: 7, dailyRate: 50, rating: 4.7, bio: "Plumbing specialist." },
          { name: "Daniel Boateng", specialty: "CARPENTER", experience: 15, dailyRate: 60, rating: 4.8, bio: "Formwork and roofing." },
          { name: "Patricia Mensah", specialty: "SUPERVISOR", experience: 18, dailyRate: 95, rating: 4.9, bio: "Site supervisor." },
        ],
      });
    }

    const users = await prisma.user.count();
    const assets = await prisma.asset.count();
    const tools = await prisma.tool.count();
    const workers = await prisma.worker.count();

    return NextResponse.json({
      ok: true,
      message: "Database seeded",
      counts: { users, assets, tools, workers },
      login: {
        admin: { email: "admin@buildforge.com", password: "admin123" },
        client: { email: "client@example.com", password: "client123" },
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
