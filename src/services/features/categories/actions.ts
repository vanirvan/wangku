"use server";

import { and, count, desc, eq, ilike } from "drizzle-orm";

import { getSessionUser, requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schemas";

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

export async function getTransactionCountByCategory(
  categoryName: string,
  type: "income" | "expense",
): Promise<number> {
  const user = await getSessionUser();
  if (!user) return 0;

  const [result] = await db
    .select({ value: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        eq(transactions.type, type),
        eq(transactions.category, categoryName),
      ),
    );

  return result?.value ?? 0;
}

export async function renameCategory(
  categoryName: string,
  newName: string,
  type: "income" | "expense",
): Promise<{ success?: boolean; error?: string }> {
  const { user, error } = await requireAuthUser();
  if (error) return { error: error.error };

  const trimmed = newName.trim();
  if (!trimmed) return { error: "Category name cannot be empty" };

  // Update the category record itself
  await db
    .update(categories)
    .set({ name: trimmed })
    .where(
      and(
        eq(categories.userId, user.id),
        eq(categories.type, type),
        eq(categories.name, categoryName),
      ),
    );

  // Update all transactions that reference this category
  await db
    .update(transactions)
    .set({ category: trimmed })
    .where(
      and(
        eq(transactions.userId, user.id),
        eq(transactions.type, type),
        eq(transactions.category, categoryName),
      ),
    );

  return { success: true };
}

export async function deleteCategory(
  categoryName: string,
  type: "income" | "expense",
): Promise<{ success?: boolean; error?: string }> {
  const { user, error } = await requireAuthUser();
  if (error) return { error: error.error };

  // Check if any transactions use this category
  const txCount = await getTransactionCountByCategory(categoryName, type);
  if (txCount > 0) {
    return {
      error: `Cannot delete: ${txCount} transaction${txCount === 1 ? "" : "s"} still use this category`,
    };
  }

  await db
    .delete(categories)
    .where(
      and(
        eq(categories.userId, user.id),
        eq(categories.type, type),
        eq(categories.name, categoryName),
      ),
    );

  return { success: true };
}
