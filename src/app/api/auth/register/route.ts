import { NextRequest, NextResponse } from "next/server";
import { registerUser, setSession } from "@/lib/auth";
import {
  docsForAccountType,
  isValidBvn,
  isValidEmail,
  isValidNin,
  isValidRc,
  isValidTin,
  type AccountType,
} from "@/lib/registration";
import { assertRegistrationAllowed } from "@/lib/registration-cooldown";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientType: AccountType = body.clientType === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
    const password = String(body.password || "");
    const agreedTerms = Boolean(body.agreedTerms);

    if (!agreedTerms) {
      return NextResponse.json(
        { error: "You must agree to the platform rules before registering" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    let name = "";
    let email = "";
    let phone = "";
    let address = "";

    if (clientType === "INDIVIDUAL") {
      name = String(body.name || "").trim();
      email = String(body.email || "").trim();
      phone = String(body.phone || "").trim();
      address = String(body.address || "").trim();
      const nin = String(body.nin || "").trim();
      const bvn = String(body.bvn || "").trim();

      if (!name || !email || !phone || !address || !nin) {
        return NextResponse.json(
          { error: "Full name, email, phone, address and NIN are required" },
          { status: 400 }
        );
      }
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      if (!isValidNin(nin)) {
        return NextResponse.json({ error: "NIN must be 11 digits" }, { status: 400 });
      }
      if (!isValidBvn(bvn)) {
        return NextResponse.json({ error: "BVN must be 11 digits when provided" }, { status: 400 });
      }

      await assertRegistrationAllowed(email, phone);

      const requiredDocs = docsForAccountType("INDIVIDUAL").filter((d) => d.required);
      const documents = Array.isArray(body.documents) ? body.documents : [];
      for (const def of requiredDocs) {
        if (!documents.some((x: any) => x.type === def.key && x.fileUrl)) {
          return NextResponse.json(
            { error: `Required document missing: ${def.label}` },
            { status: 400 }
          );
        }
      }

      const user = await registerUser(email, password, name, phone, true, {
        clientType: "INDIVIDUAL",
        address,
        nin,
        bvn: bvn || undefined,
        documents,
      });
      await setSession(user);
      return NextResponse.json({
        user,
        message:
          "Account created. An admin will review your registration. If not approved within 12 hours, access is granted automatically.",
      });
    }

    name = String(body.companyName || body.name || "").trim();
    email = String(body.companyEmail || body.email || "").trim();
    phone = String(body.companyPhone || body.phone || "").trim();
    address = String(body.companyAddress || body.address || "").trim();
    const companyRc = String(body.companyRc || body.rcNumber || "").trim();
    const companyTin = String(body.companyTin || body.tin || "").trim();
    const contactPerson = body.contactPerson || {};
    const directors = Array.isArray(body.directors) ? body.directors : [];

    if (!name || !email || !phone || !address || !companyRc || !companyTin) {
      return NextResponse.json(
        { error: "Company name, RC/CAC, TIN, email, phone and address are required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid company email" }, { status: 400 });
    }
    if (!isValidRc(companyRc)) {
      return NextResponse.json({ error: "Invalid RC/CAC number format" }, { status: 400 });
    }
    if (!isValidTin(companyTin)) {
      return NextResponse.json({ error: "Invalid TIN format" }, { status: 400 });
    }
    if (!contactPerson?.name || !contactPerson?.phone) {
      return NextResponse.json(
        { error: "Contact person name and phone are required" },
        { status: 400 }
      );
    }
    if (!directors.length || !directors[0]?.name) {
      return NextResponse.json({ error: "Add at least one director" }, { status: 400 });
    }
    for (const d of directors) {
      if (d.nin && !isValidNin(d.nin)) {
        return NextResponse.json({ error: `Invalid NIN for director ${d.name}` }, { status: 400 });
      }
      if (d.bvn && !isValidBvn(d.bvn)) {
        return NextResponse.json({ error: `Invalid BVN for director ${d.name}` }, { status: 400 });
      }
    }

    await assertRegistrationAllowed(email, phone);

    const requiredDocs = docsForAccountType("COMPANY").filter((d) => d.required);
    const documents = Array.isArray(body.documents) ? body.documents : [];
    for (const def of requiredDocs) {
      if (!documents.some((x: any) => x.type === def.key && x.fileUrl)) {
        return NextResponse.json(
          { error: `Required document missing: ${def.label}` },
          { status: 400 }
        );
      }
    }

    const user = await registerUser(email, password, name, phone, true, {
      clientType: "COMPANY",
      address,
      companyRc,
      companyTin,
      contactPerson,
      directors,
      documents,
    });
    await setSession(user);
    return NextResponse.json({
      user,
      message:
        "Company account created. An admin will review your registration. If not approved within 12 hours, access is granted automatically.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
