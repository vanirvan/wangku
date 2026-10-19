"use server";

import { and, desc, eq, ilike } from "drizzle-orm";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schemas";

import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "./data";

export async function getCategories(type: "income" | "expense") {
  const user = await getSessionUser();
  const defaults =
    type === "expense"
      ? [...DEFAULT_EXPENSE_CATEGORIES]
      : [...DEFAULT_INCOME_CATEGORIES];

  if (!user) return { data: defaults };

  const custom = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, user.id), eq(categories.type, type)))
    .orderBy(desc(categories.createdAt));

  const customNames = custom.map((c) => c.name);
  const combined = Array.from(new Set([...defaults, ...customNames]));

  return { data: combined, custom };
}

export async function ensureCustomCategory(
  name: string,
  type: "income" | "expense",
) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const defaults =
    type === "expense"
      ? (DEFAULT_EXPENSE_CATEGORIES as readonly string[])
      : (DEFAULT_INCOME_CATEGORIES as readonly string[]);

  const isDefault = defaults.some(
    (d) => d.toLowerCase() === trimmed.toLowerCase(),
  );
  if (isDefault) return null;

  const [existing] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, user.id),
        eq(categories.type, type),
        ilike(categories.name, trimmed),
      ),
    );

  if (existing) return existing;

  // insert without optimistic lock; safe for single user profile, upgrade to queue if concurrent writes spike
  const [created] = await db
    .insert(categories)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name: trimmed,
      type,
    })
    .returning();

  return created;
}
