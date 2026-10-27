import { NextRequest, NextResponse } from "next/server";
import { registerUser, setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone, agreedTerms } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password and name are required" },
        { status: 400 }
      );
    }

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

    const user = await registerUser(email, password, name, phone, true);
    await setSession(user);

    return NextResponse.json({
      user,
      message:
        "Account created. An admin will review your registration. If not approved within 12 hours, access is granted automatically.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
