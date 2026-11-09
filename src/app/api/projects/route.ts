import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Project deals:
 * - Client opens a deal (status DEAL_PENDING)
 * - Admin accepts / rejects
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

    if (session.role !== "ADMIN") {
      const st = String(session.status || "").toUpperCase();
      if (["REJECTED", "SUSPENDED", "ARCHIVED", "PENDING_APPROVAL", "PENDING"].includes(st)) {
        return NextResponse.json(
          { error: "Account must be active/approved to open a project deal" },
          { status: 403 }
        );
      }

      const extraNote = [
        startDate ? `Start: ${startDate}` : "",
        endDate ? `End: ${endDate}` : "",
        contactPhone || contactEmail || preferredContact
          ? `Contact prefs — Phone: ${contactPhone || session.phone || "-"} | Email: ${contactEmail || session.email} | Preferred: ${preferredContact || "any"}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const deal = await prisma.project.create({
        data: {
          title: String(title).trim(),
          description: String(description).trim() + (extraNote ? `\n\n${extraNote}` : ""),
          clientId: session.id,
          budget: Number(budget),
          location: String(location).trim(),
          status: "DEAL_PENDING",
          contactNote: extraNote || null,
        },
        include: {
          client: { select: { name: true, email: true, phone: true } },
        },
      });

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

    const adminNote = [
      startDate ? `Start: ${startDate}` : "",
      endDate ? `End: ${endDate}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const project = await prisma.project.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        clientId: body.clientId || session.id,
        managerId: session.id,
        budget: Number(budget),
        location: String(location).trim(),
        status: body.status || "PLANNING",
        adminNote: adminNote || null,
        contactNote: adminNote || null,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("projects POST", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to create project", detail: msg },
      { status: 500 }
    );
  }
}

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
      if (existing.clientId) {
        await prisma.notification.create({
          data: {
            userId: existing.clientId,
            title: "Project deal accepted",
            body: `Your deal "${existing.title}" was accepted. Hama Construction will contact you soon using your registered details.`,
            type: "PROJECT",
            link: "/dashboard",
          },
        });
      }
      await prisma.adminActivityLog
        .create({
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
        })
        .catch(() => null);
    } else if (action === "REJECT") {
      data.status = "DEAL_REJECTED";
      const reason = rejectReason || "Not a fit at this time";
      if (existing.clientId) {
        await prisma.notification.create({
          data: {
            userId: existing.clientId,
            title: "Project deal not accepted",
            body: `Your deal "${existing.title}" was not accepted. Reason: ${reason}`,
            type: "PROJECT",
            link: "/dashboard",
          },
        });
      }
      await prisma.adminActivityLog
        .create({
          data: {
            adminId: session.id,
            action: "REJECT_PROJECT_DEAL",
            entity: "Project",
            entityId: id,
            details: reason,
          },
        })
        .catch(() => null);
    } else if (action === "UPDATE") {
      if (status) data.status = status;
      if (progress != null) {
        data.adminNote = `Progress: ${Number(progress)}%`;
      }
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
          ? `Accepted. Contact client: ${project.client?.name || "—"} · ${project.client?.email || ""} · ${project.client?.phone || "no phone"}`
          : action === "REJECT"
            ? "Deal rejected. Client notified."
            : "Updated",
    });
  } catch (error) {
    console.error("projects PATCH", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
