import type { Address, Hash } from "viem";

export type OracleListing = {
  id: string;
  title: string;
  category: string;
  publicTease: string;
  priceLabel: string;
  weirdness: string;
  owner?: Address;
  vaultUuid?: number;
  allocateTx?: Hash;
  writeTx?: Hash;
  configureTx?: Hash;
  buyTx?: Hash;
  conditionContract?: Address;
  priceWei?: string;
  accessMode?: "owner-only" | "paid";
  createdAt: string;
};

const STORAGE_KEY = "blackbox-oracle-listings";

export const seedOracles: OracleListing[] = [
  {
    id: "seed-1",
    title: "The Anti-Resume Oracle",
    category: "Hiring Signal",
    publicTease:
      "A private rubric that predicts whether a founder will actually ship. Buyers get the answer, never the underlying notes.",
    priceLabel: "0.08 IP",
    weirdness: "Reads like a personality test, behaves like a sealed data market.",
    createdAt: "2026-05-27T00:00:00.000Z",
  },
  {
    id: "seed-2",
    title: "Leakless Alpha Desk",
    category: "Private Research",
    publicTease:
      "Encrypted market notes that can be queried for one answer at a time. The dataset stays boxed.",
    priceLabel: "0.15 IP",
    weirdness: "A vending machine for secrets that refuses to hand over the warehouse.",
    createdAt: "2026-05-27T00:00:00.000Z",
  },
  {
    id: "seed-3",
    title: "Ghost Co-Founder",
    category: "Agent Memory",
    publicTease:
      "A private decision journal for an autonomous agent. Unlocks only when the right wallet satisfies the condition.",
    priceLabel: "license gated",
    weirdness: "The app has a private brain and you can negotiate with its memory.",
    createdAt: "2026-05-27T00:00:00.000Z",
  },
];

export function loadListings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedOracles;

  try {
    const saved = JSON.parse(raw) as OracleListing[];
    return mergeListings([...saved, ...seedOracles]);
  } catch {
    return seedOracles;
  }
}

export function saveUserListing(listing: OracleListing) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const current = raw ? (JSON.parse(raw) as OracleListing[]) : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify([listing, ...current]));
}

export function updateUserListing(updated: OracleListing) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const current = raw ? (JSON.parse(raw) as OracleListing[]) : [];
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(current.map((listing) => (listing.id === updated.id ? updated : listing))),
  );
}

export function mergeListings(listings: OracleListing[]) {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    if (seen.has(listing.id)) return false;
    seen.add(listing.id);
    return true;
  });
}

export async function fetchBackendListings() {
  const response = await fetch("/api/listings", { cache: "no-store" });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(result.error ?? "Could not load database listings.");
  }

  const result = (await response.json()) as { listings?: OracleListing[] };
  return result.listings ?? [];
}

export async function saveBackendListing(listing: OracleListing) {
  const response = await fetch("/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing }),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(result.error ?? "Could not save listing to database.");
  }

  const result = (await response.json()) as { listing?: OracleListing };
  return result.listing;
}

export async function updateBackendListing(listing: OracleListing) {
  const response = await fetch("/api/listings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: listing.id, buyTx: listing.buyTx }),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(result.error ?? "Could not update listing in database.");
  }

  const result = (await response.json()) as { listing?: OracleListing };
  return result.listing;
}
