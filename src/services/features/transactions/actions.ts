"use server";

import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";

import { getSessionUser, requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Transaction } from "@/lib/db/schemas";
import { categories, paymentMethods, transactions } from "@/lib/db/schemas";
import { ensureCustomCategory } from "@/services/features/categories";

import { type TransactionFormValues, transactionSchema } from "./schema";
import type {
  GetTransactionsFilter,
  TransactionWithPaymentMethod,
} from "./types";

export async function getTransactions(
  filter?: GetTransactionsFilter,
): Promise<{ data: TransactionWithPaymentMethod[]; error?: string }> {
  const { user, error } = await requireAuthUser();
  if (error) return { error: error.error, data: [] };

  const conditions = [eq(transactions.userId, user.id)];

  if (filter?.type) {
    conditions.push(eq(transactions.type, filter.type));
  }
  if (filter?.paymentMethodId) {
    conditions.push(eq(transactions.paymentMethodId, filter.paymentMethodId));
  }
  if (filter?.category) {
    conditions.push(eq(transactions.category, filter.category));
  }
  if (filter?.startDate) {
    const start = new Date(filter.startDate);
    start.setHours(0, 0, 0, 0);
    conditions.push(gte(transactions.date, start));
  }
  if (filter?.endDate) {
    const end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(transactions.date, end));
  }
  if (filter?.search?.trim()) {
    const q = `%${filter.search.trim()}%`;
    const searchCondition = or(
      ilike(transactions.title, q),
      ilike(transactions.category, q),
      ilike(transactions.description, q),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const toPaymentMethods = alias(paymentMethods, "to_payment_methods");

  const query = db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      paymentMethodId: transactions.paymentMethodId,
      toPaymentMethodId: transactions.toPaymentMethodId,
      type: transactions.type,
      amount: transactions.amount,
      title: transactions.title,
      category: transactions.category,
      description: transactions.description,
      date: transactions.date,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      paymentMethod: {
        id: paymentMethods.id,
        name: paymentMethods.name,
        type: paymentMethods.type,
      },
      toPaymentMethod: {
        id: toPaymentMethods.id,
        name: toPaymentMethods.name,
        type: toPaymentMethods.type,
      },
    })
    .from(transactions)
    .leftJoin(
      paymentMethods,
      eq(transactions.paymentMethodId, paymentMethods.id),
    )
    .leftJoin(
      toPaymentMethods,
      eq(transactions.toPaymentMethodId, toPaymentMethods.id),
    )
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  if (filter?.limit) {
    query.limit(filter.limit);
  }

  const rows = await query;
  return { data: rows as TransactionWithPaymentMethod[] };
}

export async function createTransaction(
  data: TransactionFormValues,
): Promise<{ data?: Transaction; error?: string }> {
  const { user, error } = await requireAuthUser();
  if (error) return { error: error.error };

  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const {
    type,
    amount,
    paymentMethodId,
    toPaymentMethodId,
    title,
    category,
    description,
    date,
  } = parsed.data;

  // atomic update via db.transaction; upgrade to row-locking if high concurrency
  const result = await db.transaction(async (tx) => {
    const [sourceWallet] = await tx
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, paymentMethodId),
          eq(paymentMethods.userId, user.id),
        ),
      );

    if (!sourceWallet) {
      return { error: "Source payment method not found" };
    }

    if (type === "transfer") {
      if (!toPaymentMethodId) {
        return { error: "Destination payment method is required" };
      }
      const [destWallet] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, toPaymentMethodId),
            eq(paymentMethods.userId, user.id),
          ),
        );

      if (!destWallet) {
        return { error: "Destination payment method not found" };
      }

      const sourceBal = Number(sourceWallet.balance) || 0;
      const destBal = Number(destWallet.balance) || 0;

      await tx
        .update(paymentMethods)
        .set({ balance: String(sourceBal - amount) })
        .where(eq(paymentMethods.id, sourceWallet.id));

      await tx
        .update(paymentMethods)
        .set({ balance: String(destBal + amount) })
        .where(eq(paymentMethods.id, destWallet.id));
    } else {
      const currentBalance = Number(sourceWallet.balance) || 0;
      const newBalance =
        type === "income" ? currentBalance + amount : currentBalance - amount;

      await tx
        .update(paymentMethods)
        .set({ balance: String(newBalance) })
        .where(eq(paymentMethods.id, sourceWallet.id));
    }

    const finalCategory =
      type === "transfer" ? "Transfer" : category || "Other";
    const finalTitle =
      type === "transfer" ? title || "Wallet Transfer" : title || finalCategory;

    const [created] = await tx
      .insert(transactions)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        paymentMethodId,
        toPaymentMethodId: type === "transfer" ? toPaymentMethodId : null,
        type,
        amount: String(amount),
        title: finalTitle,
        category: finalCategory,
        description: description || null,
        date,
      })
      .returning();

    return { data: created };
  });

  if (result.error) return { error: result.error };

  if (type !== "transfer" && category) {
    await ensureCustomCategory(category, type);
  }

  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/payments");

  return { data: result.data };
}

export async function updateTransaction(
  id: string,
  data: TransactionFormValues,
): Promise<{ data?: Transaction; error?: string }> {
  const { user, error } = await requireAuthUser();
  if (error) return { error: error.error };

  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const {
    type,
    amount,
    paymentMethodId,
    toPaymentMethodId,
    title,
    category,
    description,
    date,
  } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

    if (!existing) {
      return { error: "Transaction not found" };
    }

    // Step 1: Revert effects of existing transaction
    const oldAmount = Number(existing.amount) || 0;
    if (existing.type === "transfer") {
      const [oldSrc] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, existing.paymentMethodId),
            eq(paymentMethods.userId, user.id),
          ),
        );
      if (oldSrc) {
        const bal = Number(oldSrc.balance) || 0;
        await tx
          .update(paymentMethods)
          .set({ balance: String(bal + oldAmount) })
          .where(eq(paymentMethods.id, oldSrc.id));
      }

      if (existing.toPaymentMethodId) {
        const [oldDest] = await tx
          .select()
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.id, existing.toPaymentMethodId),
              eq(paymentMethods.userId, user.id),
            ),
          );
        if (oldDest) {
          const bal = Number(oldDest.balance) || 0;
          await tx
            .update(paymentMethods)
            .set({ balance: String(bal - oldAmount) })
            .where(eq(paymentMethods.id, oldDest.id));
        }
      }
    } else {
      const [oldWallet] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, existing.paymentMethodId),
            eq(paymentMethods.userId, user.id),
          ),
        );
      if (oldWallet) {
        const bal = Number(oldWallet.balance) || 0;
        const revertedBal =
          existing.type === "income" ? bal - oldAmount : bal + oldAmount;
        await tx
          .update(paymentMethods)
          .set({ balance: String(revertedBal) })
          .where(eq(paymentMethods.id, oldWallet.id));
      }
    }

    // Step 2: Apply effects of updated transaction
    const [newSrc] = await tx
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, paymentMethodId),
          eq(paymentMethods.userId, user.id),
        ),
      );

    if (!newSrc) {
      return { error: "Source payment method not found" };
    }

    if (type === "transfer") {
      if (!toPaymentMethodId) {
        return { error: "Destination payment method is required" };
      }
      const [newDest] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, toPaymentMethodId),
            eq(paymentMethods.userId, user.id),
          ),
        );

      if (!newDest) {
        return { error: "Destination payment method not found" };
      }

      const srcBal = Number(newSrc.balance) || 0;
      const destBal = Number(newDest.balance) || 0;

      await tx
        .update(paymentMethods)
        .set({ balance: String(srcBal - amount) })
        .where(eq(paymentMethods.id, newSrc.id));

      await tx
        .update(paymentMethods)
        .set({ balance: String(destBal + amount) })
        .where(eq(paymentMethods.id, newDest.id));
    } else {
      const curBal = Number(newSrc.balance) || 0;
      const nextBal = type === "income" ? curBal + amount : curBal - amount;

      await tx
        .update(paymentMethods)
        .set({ balance: String(nextBal) })
        .where(eq(paymentMethods.id, newSrc.id));
    }

    const finalCategory =
      type === "transfer" ? "Transfer" : category || "Other";
    const finalTitle =
      type === "transfer" ? title || "Wallet Transfer" : title || finalCategory;

    const [updated] = await tx
      .update(transactions)
      .set({
        paymentMethodId,
        toPaymentMethodId: type === "transfer" ? toPaymentMethodId : null,
        type,
        amount: String(amount),
        title: finalTitle,
        category: finalCategory,
        description: description || null,
        date,
      })
      .where(eq(transactions.id, existing.id))
      .returning();

    return { data: updated };
  });

  if (result.error) return { error: result.error };

  if (type !== "transfer" && category) {
    await ensureCustomCategory(category, type);
  }

  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/payments");

  return { data: result.data };
}

export async function deleteTransaction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { user, error } = await requireAuthUser();
  if (error) return { error: error.error };

  const result = await db.transaction(async (tx) => {
    const [txRecord] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

    if (!txRecord) {
      return { error: "Transaction not found" };
    }

    const amount = Number(txRecord.amount) || 0;

    if (txRecord.type === "transfer") {
      const [srcWallet] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, txRecord.paymentMethodId),
            eq(paymentMethods.userId, user.id),
          ),
        );
      if (srcWallet) {
        const bal = Number(srcWallet.balance) || 0;
        await tx
          .update(paymentMethods)
          .set({ balance: String(bal + amount) })
          .where(eq(paymentMethods.id, srcWallet.id));
      }

      if (txRecord.toPaymentMethodId) {
        const [destWallet] = await tx
          .select()
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.id, txRecord.toPaymentMethodId),
              eq(paymentMethods.userId, user.id),
            ),
          );
        if (destWallet) {
          const bal = Number(destWallet.balance) || 0;
          await tx
            .update(paymentMethods)
            .set({ balance: String(bal - amount) })
            .where(eq(paymentMethods.id, destWallet.id));
        }
      }
    } else {
      const [wallet] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, txRecord.paymentMethodId),
            eq(paymentMethods.userId, user.id),
          ),
        );

      if (wallet) {
        const currentBalance = Number(wallet.balance) || 0;
        const revertedBalance =
          txRecord.type === "income"
            ? currentBalance - amount
            : currentBalance + amount;

        await tx
          .update(paymentMethods)
          .set({ balance: String(revertedBalance) })
          .where(eq(paymentMethods.id, wallet.id));
      }
    }

    await tx.delete(transactions).where(eq(transactions.id, txRecord.id));

    return { success: true };
  });

  if (result.error) return { error: result.error };

  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/payments");

  return { success: true };
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface DailyCashFlowItem {
  date: string;
  income: number;
  expense: number;
}

export async function getDailyCashFlow(filter?: {
  startDate?: Date | string;
  endDate?: Date | string;
}): Promise<{ data: DailyCashFlowItem[] }> {
  const user = await getSessionUser();
  if (!user) return { data: [] };

  const baseConditions = [eq(transactions.userId, user.id)];

  if (filter?.startDate) {
    const start = new Date(filter.startDate);
    start.setHours(0, 0, 0, 0);
    baseConditions.push(gte(transactions.date, start));
  }
  if (filter?.endDate) {
    const end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
    baseConditions.push(lte(transactions.date, end));
  }

  const rows = await db
    .select({
      day: sql<string>`to_char(${transactions.date}, 'YYYY-MM-DD')`,
      income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(and(...baseConditions))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM-DD')`);

  const data: DailyCashFlowItem[] = rows.map((r) => ({
    date: r.day,
    income: Number(r.income) || 0,
    expense: Number(r.expense) || 0,
  }));

  return { data };
}

export async function getCategoryBreakdown(filter?: {
  startDate?: Date | string;
  endDate?: Date | string;
  type?: "expense" | "income";
}): Promise<{ data: CategoryBreakdownItem[]; total: number }> {
  const user = await getSessionUser();
  if (!user) return { data: [], total: 0 };

  const targetType = filter?.type ?? "expense";
  const baseConditions = [
    eq(transactions.userId, user.id),
    eq(transactions.type, targetType),
  ];

  if (filter?.startDate) {
    const start = new Date(filter.startDate);
    start.setHours(0, 0, 0, 0);
    baseConditions.push(gte(transactions.date, start));
  }
  if (filter?.endDate) {
    const end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
    baseConditions.push(lte(transactions.date, end));
  }

  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      count: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .where(and(...baseConditions))
    .groupBy(transactions.category)
    .orderBy(desc(sql`sum(${transactions.amount})`));

  const total = rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  const data: CategoryBreakdownItem[] = rows.map((r) => {
    const itemTotal = Number(r.total) || 0;
    return {
      category: r.category || "Uncategorized",
      total: itemTotal,
      count: Number(r.count) || 0,
      percentage: total > 0 ? Math.round((itemTotal / total) * 100) : 0,
    };
  });

  return { data, total };
}

export async function getTransactionSummary(filter?: {
  startDate?: Date | string;
  endDate?: Date | string;
}) {
  const user = await getSessionUser();
  if (!user) {
    return {
      data: { totalIncome: 0, totalExpense: 0, netBalance: 0 },
    };
  }

  const baseConditions = [eq(transactions.userId, user.id)];

  if (filter?.startDate) {
    const start = new Date(filter.startDate);
    start.setHours(0, 0, 0, 0);
    baseConditions.push(gte(transactions.date, start));
  }
  if (filter?.endDate) {
    const end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
    baseConditions.push(lte(transactions.date, end));
  }

  const [incomeRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(...baseConditions, eq(transactions.type, "income")));

  const [expenseRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(...baseConditions, eq(transactions.type, "expense")));

  const totalIncome = Number(incomeRow?.total) || 0;
  const totalExpense = Number(expenseRow?.total) || 0;
  const netBalance = totalIncome - totalExpense;

  return {
    data: {
      totalIncome,
      totalExpense,
      netBalance,
    },
  };
}

export async function resetTransactions(): Promise<{
  success?: boolean;
  error?: string;
}> {
  const { user, error } = await requireAuthUser();
  if (error) return { error: error.error };

  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.userId, user.id));
    await tx.delete(categories).where(eq(categories.userId, user.id));
    await tx
      .update(paymentMethods)
      .set({ balance: "0" })
      .where(eq(paymentMethods.userId, user.id));
  });

  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/payments");

  return { success: true };
}
