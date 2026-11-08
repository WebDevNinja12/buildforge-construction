/** Account-type registration helpers (Individual vs Company) */

export type AccountType = "INDIVIDUAL" | "COMPANY";

export type ContactPerson = {
  name: string;
  position?: string;
  phone: string;
  email?: string;
};

export type DirectorInput = {
  name: string;
  nin?: string;
  bvn?: string;
  phone?: string;
  email?: string;
};

export type RegDocDef = {
  key: string;
  label: string;
  instruction: string;
  required: boolean;
};

const INDIVIDUAL_REG_DOCS: RegDocDef[] = [
  {
    key: "valid_id",
    label: "Valid ID",
    instruction: "National ID, international passport or driver’s licence (clear photo or PDF).",
    required: true,
  },
  {
    key: "passport_photo",
    label: "Passport photograph",
    instruction: "Recent passport-size photo on a plain background.",
    required: true,
  },
  {
    key: "proof_of_address",
    label: "Proof of address",
    instruction: "Utility bill, bank statement or tenancy letter not older than 3 months.",
    required: true,
  },
];

const COMPANY_REG_DOCS: RegDocDef[] = [
  {
    key: "cac_certificate",
    label: "CAC certificate",
    instruction: "Company registration certificate from the Corporate Affairs Commission.",
    required: true,
  },
  {
    key: "cac_status_report",
    label: "CAC status report / Forms CO2 & CO7",
    instruction: "Current CAC status report or certified Forms CO2 and CO7.",
    required: true,
  },
  {
    key: "company_proof_of_address",
    label: "Proof of company address",
    instruction: "Utility bill or lease agreement not older than 3 months.",
    required: true,
  },
  {
    key: "directors_ids",
    label: "Directors’ valid IDs",
    instruction: "Valid ID for each director listed on the application.",
    required: true,
  },
  {
    key: "directors_photos",
    label: "Directors’ passport photographs",
    instruction: "Recent passport photo for each director.",
    required: true,
  },
  {
    key: "board_resolution",
    label: "Board resolution / authorization letter",
    instruction: "Resolution or letter authorizing the contact person to register and transact.",
    required: true,
  },
];

export function docsForAccountType(type: AccountType): RegDocDef[] {
  return type === "COMPANY" ? COMPANY_REG_DOCS : INDIVIDUAL_REG_DOCS;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function isValidNin(nin: string): boolean {
  const v = String(nin || "").replace(/\s/g, "");
  if (!v) return false;
  return /^\d{11}$/.test(v);
}

export function isValidBvn(bvn: string): boolean {
  const v = String(bvn || "").replace(/\s/g, "");
  if (!v) return true;
  return /^\d{11}$/.test(v);
}

export function isValidRc(rc: string): boolean {
  const v = String(rc || "").trim().toUpperCase().replace(/\s/g, "");
  if (!v) return false;
  return /^(RC)?\d{5,10}$/.test(v) || /^BN\d{5,10}$/.test(v);
}

export function isValidTin(tin: string): boolean {
  const v = String(tin || "").replace(/[\s-]/g, "");
  if (!v) return false;
  return /^\d{8,14}$/.test(v);
}

export const ALLOWED_REG_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];
export const MAX_REG_BYTES = 5 * 1024 * 1024;
