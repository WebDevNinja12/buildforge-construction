/** Defaults + helpers for installment required documents */

export type ClientType = "INDIVIDUAL" | "COMPANY";
export type DocInputType = "FILE" | "TEXT" | "GUARANTOR" | "FORM";

export type RequiredDocDef = {
  key: string;
  label: string;
  instruction: string;
  required: boolean;
  inputType: DocInputType;
  categories: string[]; // empty = all
  clientTypes: Array<ClientType | "BOTH">;
  sortOrder: number;
};

export const DEFAULT_REQUIRED_DOCS: RequiredDocDef[] = [
  {
    key: "valid_id",
    label: "Valid ID",
    instruction: "National ID, passport or driver’s licence (clear photo or PDF).",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["BOTH"],
    sortOrder: 10,
  },
  {
    key: "passport_photo",
    label: "Passport photograph",
    instruction: "Recent passport-size photo on a plain background.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["BOTH"],
    sortOrder: 20,
  },
  {
    key: "proof_of_address",
    label: "Proof of address",
    instruction: "Utility bill or bank letter not older than 3 months.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["BOTH"],
    sortOrder: 30,
  },
  {
    key: "bank_statement",
    label: "Bank statement",
    instruction: "3–6 months personal bank statement (PDF preferred).",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["INDIVIDUAL"],
    sortOrder: 40,
  },
  {
    key: "proof_of_income",
    label: "Proof of income",
    instruction: "Payslip, employment letter, or tax return.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["INDIVIDUAL"],
    sortOrder: 50,
  },
  {
    key: "nin",
    label: "NIN",
    instruction:
      "11-digit National Identification Number. If you entered NIN at registration, it is applied automatically.",
    required: true,
    inputType: "TEXT",
    categories: [],
    clientTypes: ["INDIVIDUAL"],
    sortOrder: 54,
  },
  {
    key: "bvn",
    label: "BVN",
    instruction:
      "Enter your 11-digit Bank Verification Number. If provided at registration, it is applied automatically.",
    required: true,
    inputType: "TEXT",
    categories: [],
    clientTypes: ["INDIVIDUAL"],
    sortOrder: 55,
  },
  {
    key: "guarantor_1",
    label: "Guarantor (1)",
    instruction: "Full name, phone, address, relationship, plus ID and photo.",
    required: true,
    inputType: "GUARANTOR",
    categories: [],
    clientTypes: ["BOTH"],
    sortOrder: 60,
  },
  {
    key: "installment_agreement",
    label: "Signed installment agreement",
    instruction: "Download the template, sign it, then upload the signed copy.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["BOTH"],
    sortOrder: 70,
  },
  // Company
  {
    key: "cac_certificate",
    label: "CAC certificate",
    instruction: "Company registration certificate from CAC.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["COMPANY"],
    sortOrder: 80,
  },
  {
    key: "tin",
    label: "TIN",
    instruction: "Tax Identification Number document or certificate.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["COMPANY"],
    sortOrder: 85,
  },
  {
    key: "company_bank_statement",
    label: "Company bank statement",
    instruction: "3–6 months company account statement.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["COMPANY"],
    sortOrder: 90,
  },
  {
    key: "directors_ids",
    label: "Directors’ IDs",
    instruction: "Valid IDs for company directors.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["COMPANY"],
    sortOrder: 95,
  },
  {
    key: "board_resolution",
    label: "Board resolution",
    instruction: "Resolution authorizing this installment purchase.",
    required: true,
    inputType: "FILE",
    categories: [],
    clientTypes: ["COMPANY"],
    sortOrder: 100,
  },
  // House & Land extras
  {
    key: "guarantor_2",
    label: "Second guarantor",
    instruction: "Second guarantor details, ID and photo.",
    required: true,
    inputType: "GUARANTOR",
    categories: ["HOUSE", "LAND", "BUILDING", "APARTMENT"],
    clientTypes: ["BOTH"],
    sortOrder: 110,
  },
  {
    key: "source_of_funds",
    label: "Source of funds declaration",
    instruction: "Signed declaration of source of funds for this purchase.",
    required: true,
    inputType: "FILE",
    categories: ["HOUSE", "LAND", "BUILDING", "APARTMENT"],
    clientTypes: ["BOTH"],
    sortOrder: 120,
  },
  {
    key: "next_of_kin",
    label: "Next of kin details",
    instruction: "Name, phone, address and relationship of next of kin.",
    required: true,
    inputType: "FORM",
    categories: ["HOUSE", "LAND", "BUILDING", "APARTMENT"],
    clientTypes: ["BOTH"],
    sortOrder: 130,
  },
];

export function matchesCategory(def: RequiredDocDef, category: string) {
  if (!def.categories.length) return true;
  return def.categories.includes(category.toUpperCase());
}

export function matchesClientType(def: RequiredDocDef, clientType: ClientType) {
  return def.clientTypes.includes("BOTH") || def.clientTypes.includes(clientType);
}

export function filterDefaults(category: string, clientType: ClientType) {
  return DEFAULT_REQUIRED_DOCS.filter(
    (d) => matchesCategory(d, category) && matchesClientType(d, clientType)
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}

export const ALLOWED_DOC_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
export const MAX_DOC_BYTES = 5 * 1024 * 1024;
