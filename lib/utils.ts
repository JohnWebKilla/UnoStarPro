import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateNameSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  const s1Clean = s1.replace(/[^a-z0-9]/g, "");
  const s2Clean = s2.replace(/[^a-z0-9]/g, "");
  if (s1Clean === s2Clean) return 0.8;

  // Levenshtein distance calculation
  const matrix = Array(s1.length + 1)
    .fill(null)
    .map(() => Array(s2.length + 1).fill(0));
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s1.length][s2.length];
  return 1 - distance / maxLength;
}
