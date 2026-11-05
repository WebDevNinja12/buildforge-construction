import { readFileSync, existsSync } from "fs";
import path from "path";

/** Official Hama Construction registration on the company seal */
export const COMPANY_SEAL_RC = "RC - 8827959";

/**
 * Load official seal PNG when present at public/seals/hama-company-seal.png.
 * Returns null if the file is not bundled (PDF builder draws a vector seal instead).
 */
export function getCompanySealBytes(): Uint8Array | null {
  try {
    const candidates = [
      path.join(process.cwd(), "public", "seals", "hama-company-seal.png"),
      path.join(process.cwd(), "public", "seals", "company-seal.png"),
      path.join(process.cwd(), "public", "company-seal.png"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        return new Uint8Array(readFileSync(p));
      }
    }
  } catch {
    /* fs unavailable or missing */
  }
  return null;
}
