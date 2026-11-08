/** Registration helpers: account types, validation, default registration documents */

export type AccountType = "INDIVIDUAL" | "COMPANY";

export type DirectorInput = {
  name: string;
  nin?: string;
  bvn?: string;
  phone?: string;
  email?: string;
};

export type ContactPerson = {
  name: string;
  position?: string;
  phone?: string;
  email?: string;
};

export type RegistrationDocDef = {
  key: string;
  label: string;
  instruction: string;
  required: boolean;
  accountTypes: AccountType[];
};

/** Docs collected at signup (not installment-only) */
export const DEFAULT_REGISTRATION_DOCS: RegistrationDocDef[] = [
  {
    key: "valid_id",
    label: "Valid ID",
    instruction: "National ID, passport or driver’s licence (PDF/JPG/PNG).",
    required: true,
    accountTypes: ["INDIVIDUAL"],
  },
  {
    key: "passport_photo",
    label: "Passport photograph",
    instruction: "Recent passport-size photo on a plain background.",
    required: true,
    accountTypes: ["INDIVIDUAL"],
  },
  {
    key: "proof_of_address",
    label: "Proof of address",
    instruction: "Utility bill or bank letter not older than 3 months.",
    required: true,
    accountTypes: ["INDIVIDUAL"],
  },
  {
    key: "cac_certificate",
    label: "CAC certificate",
    instruction: "Certificate of incorporation from CAC.",
    required: true,
    accountTypes: ["COMPANY"],
  },
  {
    key: "cac_status_report",
    label: "CAC status report / Forms CO7 & CO2",
    instruction: "Recent CAC status report or Forms CO7 and CO2.",
    required: true,
    accountTypes: ["COMPANY"],
  },
  {
    key: "company_proof_of_address",
    label: "Proof of company address",
    instruction: "Utility bill or lease in company name (not older than 3 months).",
    required: true,
    accountTypes: ["COMPANY"],
  },
  {
    key: "director_id",
    label: "Director valid ID(s)",
    instruction: "Valid ID for each director listed (can be a combined PDF).",
    required: true,
    accountTypes: ["COMPANY"],
  },
  {
    key: "director_passport_photo",
    label: "Director passport photograph(s)",
    instruction: "Passport photos for each director.",
    required: true,
    accountTypes: ["COMPANY"],
  },
  {
    key: "board_resolution",
    label: "Board resolution / authorization letter",
    instruction: "Letter authorizing this account holder to act for the company.",
    required: true,
    accountTypes: ["COMPANY"],
  },
];

export function docsForAccountType(type: AccountType) {
  return DEFAULT_REGISTRATION_DOCS.filter((d) => d.accountTypes.includes(type));
}

export function normalizeDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

export function isValidNin(nin: string) {
  const d = normalizeDigits(nin);
  return d.length === 11;
}

export function isValidBvn(bvn: string) {
  if (!bvn || !String(bvn).trim()) return true; // optional at registration
  const d = normalizeDigits(bvn);
  return d.length === 11;
}

export function isValidRc(rc: string) {
  const s = String(rc || "").trim().toUpperCase();
  // e.g. RC123456, BN123456, or digits
  return s.length >= 5 && s.length <= 20 && /^[A-Z0-9\-\/]+$/.test(s);
}

export function isValidTin(tin: string) {
  const s = String(tin || "").trim();
  const d = normalizeDigits(s);
  return d.length >= 8 && d.length <= 14;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
