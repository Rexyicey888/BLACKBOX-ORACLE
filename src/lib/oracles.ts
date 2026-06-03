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
const MAX_TEXT_LENGTH = 1200;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const PRICE_WEI_RE = /^\d+$/;

export const seedOracles: OracleListing[] = [
  {
    id: "seed-1",
    title: "Backchannel Deal Signal",
    category: "Private Research",
    publicTease:
      "A sealed diligence note for one startup deal. Buyers unlock the verdict, not the source notes.",
    priceLabel: "0.08 IP",
    weirdness: "Turns private research into a paid answer while the evidence stays sealed.",
    createdAt: "2026-05-27T00:00:00.000Z",
  },
  {
    id: "seed-2",
    title: "Anonymous Creator Tip",
    category: "Creator Intel",
    publicTease:
      "A behind-the-scenes sponsorship signal. Unlock the actionable takeaway without exposing the source conversation.",
    priceLabel: "0.15 IP",
    weirdness: "A gossip-shaped product with a privacy boundary instead of a screenshot dump.",
    createdAt: "2026-05-27T00:00:00.000Z",
  },
  {
    id: "seed-3",
    title: "Blind Item Drop",
    category: "Entertainment Intel",
    publicTease:
      "A verified behind-the-scenes tip with the names and screenshots sealed. Buyers unlock the answer, not the source trail.",
    priceLabel: "0.05 IP",
    weirdness: "Celebrity tea with a privacy boundary: the claim can be sold without dumping the receipts.",
    createdAt: "2026-05-27T00:00:00.000Z",
  },
];

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, MAX_TEXT_LENGTH);
}

function cleanAddress(value: unknown): Address | undefined {
  const cleaned = cleanText(value);
  return ADDRESS_RE.test(cleaned) ? (cleaned as Address) : undefined;
}

function cleanHash(value: unknown): Hash | undefined {
  const cleaned = cleanText(value);
  return HASH_RE.test(cleaned) ? (cleaned as Hash) : undefined;
}

function cleanPriceWei(value: unknown) {
  const cleaned = cleanText(value);
  return PRICE_WEI_RE.test(cleaned) ? cleaned : undefined;
}

function cleanVaultUuid(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function cleanCreatedAt(value: unknown) {
  const date = new Date(cleanText(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanAccessMode(value: unknown): OracleListing["accessMode"] {
  return value === "owner-only" || value === "paid" ? value : undefined;
}

export function cleanListing(value: unknown): OracleListing | undefined {
  const record = value as Partial<Record<keyof OracleListing, unknown>> | undefined;
  const id = cleanText(record?.id);
  const title = cleanText(record?.title);
  const publicTease = cleanText(record?.publicTease);

  if (!id || !title || !publicTease) return undefined;

  return {
    id,
    title,
    category: cleanText(record?.category, "Private Insight"),
    publicTease,
    priceLabel: cleanText(record?.priceLabel, "0.10 IP"),
    weirdness: cleanText(record?.weirdness, "A sealed answer that exists before anyone can see it."),
    owner: cleanAddress(record?.owner),
    vaultUuid: cleanVaultUuid(record?.vaultUuid),
    allocateTx: cleanHash(record?.allocateTx),
    writeTx: cleanHash(record?.writeTx),
    configureTx: cleanHash(record?.configureTx),
    buyTx: cleanHash(record?.buyTx),
    conditionContract: cleanAddress(record?.conditionContract),
    priceWei: cleanPriceWei(record?.priceWei),
    accessMode: cleanAccessMode(record?.accessMode),
    createdAt: cleanCreatedAt(record?.createdAt),
  };
}

function readSavedListings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved.flatMap((listing) => cleanListing(listing) ?? []) : [];
  } catch {
    return [];
  }
}

export function loadListings() {
  return mergeListings([...readSavedListings(), ...seedOracles]);
}

export function saveUserListing(listing: OracleListing) {
  const cleaned = cleanListing(listing);
  if (!cleaned) throw new Error("Listing metadata is incomplete.");
  localStorage.setItem(STORAGE_KEY, JSON.stringify([cleaned, ...readSavedListings()]));
}

export function updateUserListing(updated: OracleListing) {
  const cleaned = cleanListing(updated);
  if (!cleaned) throw new Error("Listing metadata is incomplete.");
  const current = readSavedListings();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(current.map((listing) => (listing.id === cleaned.id ? cleaned : listing))),
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

  const result = (await response.json()) as { listings?: unknown[] };
  return Array.isArray(result.listings) ? result.listings.flatMap((listing) => cleanListing(listing) ?? []) : [];
}

export async function saveBackendListing(listing: OracleListing) {
  const cleaned = cleanListing(listing);
  if (!cleaned) throw new Error("Listing metadata is incomplete.");

  const response = await fetch("/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing: cleaned }),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(result.error ?? "Could not save listing to database.");
  }

  const result = (await response.json()) as { listing?: unknown };
  return cleanListing(result.listing);
}

export async function updateBackendListing(listing: OracleListing) {
  const cleaned = cleanListing(listing);
  if (!cleaned) throw new Error("Listing metadata is incomplete.");

  const response = await fetch("/api/listings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: cleaned.id, buyTx: cleaned.buyTx }),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(result.error ?? "Could not update listing in database.");
  }

  const result = (await response.json()) as { listing?: unknown };
  return cleanListing(result.listing);
}
