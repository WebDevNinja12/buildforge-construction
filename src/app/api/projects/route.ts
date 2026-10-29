import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Project deals:
 * - Client opens a deal (status DEAL_PENDING) from dashboard — not published on public page
 * - Admin accepts / rejects; on accept uses client contact to connect offline
 * - Public /projects page uses FinishedProject (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    if (session.role === "ADMIN") {
      const projects = await prisma.project.findMany({
        where: status ? { status } : undefined,
        include: {
          milestones: true,
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
              verificationStatus: true,
            },
          },
          manager: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(projects);
    }

    const projects = await prisma.project.findMany({
      where: {
        OR: [{ clientId: session.id }, { managerId: session.id }],
        ...(status ? { status } : {}),
      },
      include: {
        milestones: true,
        client: { select: { name: true, email: true, phone: true } },
        manager: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      budget,
      location,
      startDate,
      endDate,
      contactPhone,
      contactEmail,
      preferredContact,
    } = body;

    if (!title || !description || !budget || !location) {
      return NextResponse.json(
        { error: "Title, description, budget and location required" },
        { status: 400 }
      );
    }

    // Clients can only open a deal for review — never publish to public projects page
    if (session.role !== "ADMIN") {
      if (!["APPROVED", "UNDER_REVIEW", "VERIFIED"].includes(session.status || "")) {
        return NextResponse.json(
          { error: "Account must be approved to open a project deal" },
          { status: 403 }
        );
      }

      const deal = await prisma.project.create({
        data: {
          title: String(title).trim(),
          description:
            String(description).trim() +
            (contactPhone || contactEmail || preferredContact
              ? `\n\n[Client contact prefs]\nPhone: ${contactPhone || session.phone || "-"}\nEmail: ${contactEmail || session.email}\nPreferred: ${preferredContact || "any"}`
              : ""),
          clientId: session.id,
          budget: Number(budget),
          location: String(location).trim(),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          status: "DEAL_PENDING",
          progress: 0,
        },
        include: {
          client: { select: { name: true, email: true, phone: true } },
        },
      });

      // Notify all admins
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      for (const a of admins) {
        await prisma.notification
          .create({
            data: {
              userId: a.id,
              title: "New project deal",
              body: `${session.name} opened a deal: "${deal.title}" — review in Admin → Project deals.`,
              type: "PROJECT",
              link: "/admin",
            },
          })
          .catch(() => null);
      }

      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Deal submitted",
          body: `Your project deal "${deal.title}" is under admin review. If accepted, Hama will contact you using your profile details.`,
          type: "PROJECT",
          link: "/dashboard",
        },
      });

      return NextResponse.json(
        {
          ...deal,
          message:
            "Deal submitted for admin review. You will be contacted if accepted.",
        },
        { status: 201 }
      );
    }

    // Admin can create an internal project (already accepted client work)
    const project = await prisma.project.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        clientId: body.clientId || session.id,
        managerId: session.id,
        budget: Number(budget),
        location: String(location).trim(),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: body.status || "PLANNING",
        progress: 0,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

/**
 * Admin: accept / reject deal, or update status
 * body: { id, action: "ACCEPT" | "REJECT" | "UPDATE", rejectReason?, status?, progress? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, rejectReason, status, progress, managerId } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const existing = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (action === "ACCEPT") {
      data.status = "DEAL_ACCEPTED";
      data.managerId = managerId || session.id;
      await prisma.notification.create({
        data: {
          userId: existing.clientId,
          title: "Project deal accepted",
          body: `Your deal "${existing.title}" was accepted. Hama Construction will contact you soon using your registered details.`,
          type: "PROJECT",
          link: "/dashboard",
        },
      });
      await prisma.adminActivityLog.create({
        data: {
          adminId: session.id,
          action: "ACCEPT_PROJECT_DEAL",
          entity: "Project",
          entityId: id,
          details: JSON.stringify({
            client: existing.client,
            title: existing.title,
          }),
        },
      });
    } else if (action === "REJECT") {
      data.status = "DEAL_REJECTED";
      const reason = rejectReason || "Not a fit at this time";
      await prisma.notification.create({
        data: {
          userId: existing.clientId,
          title: "Project deal not accepted",
          body: `Your deal "${existing.title}" was not accepted. Reason: ${reason}`,
          type: "PROJECT",
          link: "/dashboard",
        },
      });
      await prisma.adminActivityLog.create({
        data: {
          adminId: session.id,
          action: "REJECT_PROJECT_DEAL",
          entity: "Project",
          entityId: id,
          details: reason,
        },
      });
    } else if (action === "UPDATE") {
      if (status) data.status = status;
      if (progress != null) data.progress = Number(progress);
      if (managerId) data.managerId = managerId;
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        client: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    return NextResponse.json({
      ...project,
      message:
        action === "ACCEPT"
          ? `Accepted. Contact client: ${project.client.name} · ${project.client.email} · ${project.client.phone || "no phone"}`
          : action === "REJECT"
            ? "Deal rejected. Client notified."
            : "Updated",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
