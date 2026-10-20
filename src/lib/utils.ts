import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export const ASSET_TYPES = [
  { value: "HOUSE", label: "House" },
  { value: "HOTEL", label: "Hotel" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "LAND", label: "Land" },
  { value: "COMMERCIAL", label: "Commercial" },
] as const;

export const TOOL_CATEGORIES = [
  { value: "POWER", label: "Power Tools" },
  { value: "HAND", label: "Hand Tools" },
  { value: "HEAVY", label: "Heavy Equipment" },
  { value: "SAFETY", label: "Safety Equipment" },
] as const;

export const WORKER_SPECIALTIES = [
  { value: "MASON", label: "Mason / Bricklayer" },
  { value: "ELECTRICIAN", label: "Electrician" },
  { value: "PLUMBER", label: "Plumber" },
  { value: "CARPENTER", label: "Carpenter" },
  { value: "GENERAL", label: "General Labor" },
  { value: "SUPERVISOR", label: "Site Supervisor" },
] as const;
