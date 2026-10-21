"use server";

import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";

import { getSessionUser, requireAuthUser } from "@/lib/auth";
import { getCurrencyConfig } from "@/lib/currency";
import { db } from "@/lib/db";
import type { Transaction } from "@/lib/db/schemas";
import { categories, paymentMethods, transactions } from "@/lib/db/schemas";
import { convertAmountSync, getExchangeRates } from "@/lib/exchange-rates";
import { ensureCustomCategory } from "@/services/features/categories";
import { getUserSettings } from "@/services/features/settings";

import { type TransactionFormValues, transactionSchema } from "./schema";
import type {
  GetTransactionsFilter,
  TransactionWithPaymentMethod,
} from "./types";

function safeAdjustBalance(
  currentBalance: number,
  delta: number,
  currency: string,
): string {
  const config = getCurrencyConfig(currency);
  const next = currentBalance + delta;
  if (config.decimals === 0) {
    return String(Math.round(next));
  }
  return String(Math.round(next * 100) / 100);
}

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
      currency: transactions.currency,
      amount: transactions.amount,
      toAmount: transactions.toAmount,
      exchangeRate: transactions.exchangeRate,
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
        currency: paymentMethods.currency,
      },
      toPaymentMethod: {
        id: toPaymentMethods.id,
        name: toPaymentMethods.name,
        type: toPaymentMethods.type,
        currency: toPaymentMethods.currency,
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
    toAmount,
    exchangeRate,
    paymentMethodId,
    toPaymentMethodId,
    title,
    category,
    description,
    date,
  } = parsed.data;

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

    const txCurrency = sourceWallet.currency || "IDR";
    let finalToAmount = toAmount ?? null;
    let finalExchangeRate = exchangeRate ?? null;

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

      const destCurrency = destWallet.currency || "IDR";

      if (destCurrency === txCurrency) {
        finalToAmount = amount;
        finalExchangeRate = 1;
      } else if (!finalToAmount) {
        const rates = await getExchangeRates();
        finalToAmount = convertAmountSync(
          amount,
          txCurrency,
          destCurrency,
          rates,
        );
        finalExchangeRate = finalToAmount / amount;
      } else if (!finalExchangeRate) {
        finalExchangeRate = finalToAmount / amount;
      }

      const sourceBal = Number(sourceWallet.balance) || 0;
      const destBal = Number(destWallet.balance) || 0;

      await tx
        .update(paymentMethods)
        .set({
          balance: safeAdjustBalance(sourceBal, -amount, txCurrency),
        })
        .where(eq(paymentMethods.id, sourceWallet.id));

      await tx
        .update(paymentMethods)
        .set({
          balance: safeAdjustBalance(destBal, finalToAmount, destCurrency),
        })
        .where(eq(paymentMethods.id, destWallet.id));
    } else {
      const currentBalance = Number(sourceWallet.balance) || 0;
      const delta = type === "income" ? amount : -amount;

      await tx
        .update(paymentMethods)
        .set({
          balance: safeAdjustBalance(currentBalance, delta, txCurrency),
        })
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
        currency: txCurrency,
        amount: String(amount),
        toAmount: finalToAmount !== null ? String(finalToAmount) : null,
        exchangeRate:
          finalExchangeRate !== null ? String(finalExchangeRate) : null,
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
    toAmount,
    exchangeRate,
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

    // Revert existing transaction balances
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
          .set({
            balance: safeAdjustBalance(
              bal,
              oldAmount,
              oldSrc.currency || "IDR",
            ),
          })
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
          const oldDestAmt = existing.toAmount
            ? Number(existing.toAmount)
            : oldAmount;
          await tx
            .update(paymentMethods)
            .set({
              balance: safeAdjustBalance(
                bal,
                -oldDestAmt,
                oldDest.currency || "IDR",
              ),
            })
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
        const revertDelta = existing.type === "income" ? -oldAmount : oldAmount;
        await tx
          .update(paymentMethods)
          .set({
            balance: safeAdjustBalance(
              bal,
              revertDelta,
              oldWallet.currency || "IDR",
            ),
          })
          .where(eq(paymentMethods.id, oldWallet.id));
      }
    }

    // Apply updated transaction balances
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

    const txCurrency = newSrc.currency || "IDR";
    let finalToAmount = toAmount ?? null;
    let finalExchangeRate = exchangeRate ?? null;

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

      const destCurrency = newDest.currency || "IDR";

      if (destCurrency === txCurrency) {
        finalToAmount = amount;
        finalExchangeRate = 1;
      } else if (!finalToAmount) {
        const rates = await getExchangeRates();
        finalToAmount = convertAmountSync(
          amount,
          txCurrency,
          destCurrency,
          rates,
        );
        finalExchangeRate = finalToAmount / amount;
      } else if (!finalExchangeRate) {
        finalExchangeRate = finalToAmount / amount;
      }

      const srcBal = Number(newSrc.balance) || 0;
      const destBal = Number(newDest.balance) || 0;

      await tx
        .update(paymentMethods)
        .set({
          balance: safeAdjustBalance(srcBal, -amount, txCurrency),
        })
        .where(eq(paymentMethods.id, newSrc.id));

      await tx
        .update(paymentMethods)
        .set({
          balance: safeAdjustBalance(destBal, finalToAmount, destCurrency),
        })
        .where(eq(paymentMethods.id, newDest.id));
    } else {
      const curBal = Number(newSrc.balance) || 0;
      const delta = type === "income" ? amount : -amount;

      await tx
        .update(paymentMethods)
        .set({
          balance: safeAdjustBalance(curBal, delta, txCurrency),
        })
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
        currency: txCurrency,
        amount: String(amount),
        toAmount: finalToAmount !== null ? String(finalToAmount) : null,
        exchangeRate:
          finalExchangeRate !== null ? String(finalExchangeRate) : null,
        title: finalTitle,
        category: finalCategory,
        description: description || null,
        date,
      })
      .where(eq(transactions.id, id))
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
          .set({
            balance: safeAdjustBalance(
              bal,
              amount,
              srcWallet.currency || "IDR",
            ),
          })
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
          const destAmt = txRecord.toAmount
            ? Number(txRecord.toAmount)
            : amount;
          await tx
            .update(paymentMethods)
            .set({
              balance: safeAdjustBalance(
                bal,
                -destAmt,
                destWallet.currency || "IDR",
              ),
            })
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
        const currentBal = Number(wallet.balance) || 0;
        const revertDelta = txRecord.type === "income" ? -amount : amount;
        await tx
          .update(paymentMethods)
          .set({
            balance: safeAdjustBalance(
              currentBal,
              revertDelta,
              wallet.currency || "IDR",
            ),
          })
          .where(eq(paymentMethods.id, wallet.id));
      }
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
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

  const [{ data: settings }, rates] = await Promise.all([
    getUserSettings(),
    getExchangeRates(),
  ]);
  const baseCurrency = settings?.baseCurrency || "IDR";

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

  const txRows = await db
    .select({
      date: transactions.date,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(and(...baseConditions))
    .orderBy(transactions.date);

  const dayMap = new Map<string, { income: number; expense: number }>();

  for (const row of txRows) {
    const day = row.date.toISOString().slice(0, 10);
    const rawAmt = Number(row.amount) || 0;
    const txCurr = row.currency || "IDR";
    const converted = convertAmountSync(rawAmt, txCurr, baseCurrency, rates);

    const existing = dayMap.get(day) ?? { income: 0, expense: 0 };
    if (row.type === "income") {
      existing.income += converted;
    } else if (row.type === "expense") {
      existing.expense += converted;
    }
    dayMap.set(day, existing);
  }

  const data: DailyCashFlowItem[] = Array.from(dayMap.entries())
    .map(([date, item]) => ({
      date,
      income: item.income,
      expense: item.expense,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { data };
}

export async function getCategoryBreakdown(filter?: {
  startDate?: Date | string;
  endDate?: Date | string;
  type?: "expense" | "income";
}): Promise<{ data: CategoryBreakdownItem[]; total: number }> {
  const user = await getSessionUser();
  if (!user) return { data: [], total: 0 };

  const [{ data: settings }, rates] = await Promise.all([
    getUserSettings(),
    getExchangeRates(),
  ]);
  const baseCurrency = settings?.baseCurrency || "IDR";

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

  const txRows = await db
    .select({
      category: transactions.category,
      amount: transactions.amount,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(and(...baseConditions));

  const categoryMap = new Map<string, { total: number; count: number }>();
  let overallTotal = 0;

  for (const row of txRows) {
    const cat = row.category || "Uncategorized";
    const rawAmt = Number(row.amount) || 0;
    const txCurr = row.currency || "IDR";
    const converted = convertAmountSync(rawAmt, txCurr, baseCurrency, rates);

    overallTotal += converted;
    const existing = categoryMap.get(cat) ?? { total: 0, count: 0 };
    categoryMap.set(cat, {
      total: existing.total + converted,
      count: existing.count + 1,
    });
  }

  const data: CategoryBreakdownItem[] = Array.from(categoryMap.entries())
    .map(([category, info]) => ({
      category,
      total: info.total,
      count: info.count,
      percentage:
        overallTotal > 0 ? Math.round((info.total / overallTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { data, total: overallTotal };
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

  const [{ data: settings }, rates] = await Promise.all([
    getUserSettings(),
    getExchangeRates(),
  ]);
  const baseCurrency = settings?.baseCurrency || "IDR";

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

  const txRows = await db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(and(...baseConditions));

  let totalIncome = 0;
  let totalExpense = 0;

  for (const row of txRows) {
    const rawAmt = Number(row.amount) || 0;
    const txCurr = row.currency || "IDR";
    const converted = convertAmountSync(rawAmt, txCurr, baseCurrency, rates);

    if (row.type === "income") {
      totalIncome += converted;
    } else if (row.type === "expense") {
      totalExpense += converted;
    }
  }

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
