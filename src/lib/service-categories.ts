/**
 * Hama Construction — service categories and listing modes
 * SALE: ownership transfer. RENT/HIRE: temporary use.
 */

export type ListingMode = "SALE" | "RENT" | "HIRE";

export type ServiceCategoryId =
  | "HOUSE"
  | "BUILDING"
  | "COMMERCIAL"
  | "APARTMENT"
  | "LAND"
  | "HOTEL"
  | "TOOLS"
  | "WORKERS"
  | "OTHER";

export type ServiceCategory = {
  id: ServiceCategoryId;
  label: string;
  mode: ListingMode;
  modeLabel: string;
  supportsInstallment: boolean;
  requiresReservationFee: boolean;
  defaultReservationFee: number;
  kind: "ASSET" | "TOOL" | "WORKER" | "OTHER";
  description: string;
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "HOUSE",
    label: "House",
    mode: "SALE",
    modeLabel: "For sale",
    supportsInstallment: true,
    requiresReservationFee: true,
    defaultReservationFee: 50_000,
    kind: "ASSET",
    description: "Residential houses for sale",
  },
  {
    id: "BUILDING",
    label: "Building",
    mode: "SALE",
    modeLabel: "For sale",
    supportsInstallment: true,
    requiresReservationFee: true,
    defaultReservationFee: 50_000,
    kind: "ASSET",
    description: "Buildings for sale",
  },
  {
    id: "COMMERCIAL",
    label: "Commercial",
    mode: "SALE",
    modeLabel: "For sale",
    supportsInstallment: true,
    requiresReservationFee: true,
    defaultReservationFee: 50_000,
    kind: "ASSET",
    description: "Commercial property for sale",
  },
  {
    id: "APARTMENT",
    label: "Apartment",
    mode: "RENT",
    modeLabel: "For rent",
    supportsInstallment: true,
    requiresReservationFee: true,
    defaultReservationFee: 30_000,
    kind: "ASSET",
    description: "Apartments for rent (not sale)",
  },
  {
    id: "LAND",
    label: "Land",
    mode: "SALE",
    modeLabel: "For sale",
    supportsInstallment: true,
    requiresReservationFee: true,
    defaultReservationFee: 50_000,
    kind: "ASSET",
    description: "Land for sale",
  },
  {
    id: "HOTEL",
    label: "Hotel",
    mode: "HIRE",
    modeLabel: "Hire / stay",
    supportsInstallment: true,
    requiresReservationFee: true,
    defaultReservationFee: 20_000,
    kind: "ASSET",
    description: "Hotel rooms and stays",
  },
  {
    id: "TOOLS",
    label: "Tools",
    mode: "HIRE",
    modeLabel: "For hire",
    supportsInstallment: true,
    requiresReservationFee: false,
    defaultReservationFee: 0,
    kind: "TOOL",
    description: "Construction tools and equipment hire",
  },
  {
    id: "WORKERS",
    label: "Workers",
    mode: "HIRE",
    modeLabel: "For hire",
    supportsInstallment: false,
    requiresReservationFee: false,
    defaultReservationFee: 0,
    kind: "WORKER",
    description: "Skilled and general labour hire",
  },
  {
    id: "OTHER",
    label: "Other services",
    mode: "HIRE",
    modeLabel: "Service",
    supportsInstallment: false,
    requiresReservationFee: false,
    defaultReservationFee: 0,
    kind: "OTHER",
    description: "Other construction services and project management",
  },
];

export const ASSET_CATEGORIES = SERVICE_CATEGORIES.filter((c) => c.kind === "ASSET");
export const SALE_CATEGORIES = SERVICE_CATEGORIES.filter((c) => c.mode === "SALE");
export const RENT_HIRE_CATEGORIES = SERVICE_CATEGORIES.filter(
  (c) => c.mode === "RENT" || c.mode === "HIRE"
);

export function getCategory(id: string | null | undefined): ServiceCategory | undefined {
  const key = String(id || "").toUpperCase().trim();
  return SERVICE_CATEGORIES.find((c) => c.id === key);
}

export function defaultReservationFeeFor(type: string | null | undefined): number {
  return getCategory(type)?.defaultReservationFee ?? 0;
}

export function requiresReservationFee(type: string | null | undefined): boolean {
  return Boolean(getCategory(type)?.requiresReservationFee);
}

export function isSaleCategory(type: string | null | undefined): boolean {
  return getCategory(type)?.mode === "SALE";
}

export function isRentOrHireCategory(type: string | null | undefined): boolean {
  const m = getCategory(type)?.mode;
  return m === "RENT" || m === "HIRE";
}

export const CLIENT_SERVICE_TABS = [
  { id: "HOUSE", label: "Houses", category: "HOUSE" as ServiceCategoryId },
  { id: "BUILDING", label: "Buildings", category: "BUILDING" as ServiceCategoryId },
  { id: "COMMERCIAL", label: "Commercial", category: "COMMERCIAL" as ServiceCategoryId },
  { id: "APARTMENT", label: "Apartments", category: "APARTMENT" as ServiceCategoryId },
  { id: "LAND", label: "Land", category: "LAND" as ServiceCategoryId },
  { id: "HOTEL", label: "Hotels", category: "HOTEL" as ServiceCategoryId },
  { id: "TOOLS", label: "Tools", category: "TOOLS" as ServiceCategoryId },
  { id: "WORKERS", label: "Workers", category: "WORKERS" as ServiceCategoryId },
  { id: "OTHER", label: "Other", category: "OTHER" as ServiceCategoryId },
] as const;
