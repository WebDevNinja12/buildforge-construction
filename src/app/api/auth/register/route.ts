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

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = str(body.password);
    const agreedTerms = Boolean(body.agreedTerms);

    let clientType: AccountType =
      body.clientType === "COMPANY" || body.accountType === "COMPANY"
        ? "COMPANY"
        : body.clientType === "INDIVIDUAL" || body.accountType === "INDIVIDUAL"
          ? "INDIVIDUAL"
          : str(body.companyName) || str(body.companyRc) || str(body.companyTin)
            ? "COMPANY"
            : "INDIVIDUAL";

    if (!agreedTerms) {
      return NextResponse.json(
        { error: "You must agree to the platform rules before registering" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (clientType === "INDIVIDUAL") {
      const name = str(body.name);
      const email = str(body.email).toLowerCase();
      const phone = str(body.phone);
      const address = str(body.address);
      const nin = str(body.nin).replace(/\D/g, "");
      const bvn = str(body.bvn).replace(/\D/g, "");

      const missing: string[] = [];
      if (!name) missing.push("full name");
      if (!email) missing.push("email");
      if (!phone) missing.push("phone");
      if (!address) missing.push("address");
      if (!nin) missing.push("NIN");
      if (missing.length) {
        return NextResponse.json(
          {
            error: `Missing required fields: ${missing.join(", ")}. Please complete the form.`,
            missing,
            clientType,
          },
          { status: 400 }
        );
      }
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      if (!isValidNin(nin)) {
        return NextResponse.json({ error: "NIN must be exactly 11 digits" }, { status: 400 });
      }
      if (!isValidBvn(bvn)) {
        return NextResponse.json({ error: "BVN must be exactly 11 digits when provided" }, { status: 400 });
      }

      await assertRegistrationAllowed(email, phone);

      const documents = Array.isArray(body.documents) ? body.documents : [];

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

    const name = str(body.companyName || body.name);
    const email = str(body.companyEmail || body.email).toLowerCase();
    const phone = str(body.companyPhone || body.phone);
    const address = str(body.companyAddress || body.address);
    const companyRc = str(body.companyRc).toUpperCase();
    const companyTin = str(body.companyTin);
    const contactPerson = body.contactPerson || {};
    const directors = Array.isArray(body.directors) ? body.directors : [];

    const missing: string[] = [];
    if (!name) missing.push("company name");
    if (!email) missing.push("company email");
    if (!phone) missing.push("company phone");
    if (!address) missing.push("company address");
    if (!companyRc) missing.push("RC/CAC");
    if (!companyTin) missing.push("TIN");
    if (missing.length) {
      return NextResponse.json(
        {
          error: `Missing required fields: ${missing.join(", ")}. Please complete the form.`,
          missing,
          clientType,
        },
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
    if (!str(contactPerson?.name) || !str(contactPerson?.phone)) {
      return NextResponse.json(
        { error: "Contact person name and phone are required" },
        { status: 400 }
      );
    }
    if (!directors.length || !str(directors[0]?.name)) {
      return NextResponse.json({ error: "Add at least one director with a name" }, { status: 400 });
    }

    await assertRegistrationAllowed(email, phone);

    const documents = Array.isArray(body.documents) ? body.documents : [];

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
