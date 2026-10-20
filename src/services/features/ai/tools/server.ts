import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { categories, paymentMethods, transactions } from "@/lib/db/schemas";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "@/services/features/categories";
import { invalidatePaymentMethodsCache } from "@/services/features/payments/cache";

import {
  createCategoryDef,
  createWalletDef,
  deleteTransactionDef,
  deleteWalletDef,
  getCategoriesDef,
  getRecentTransactionsDef,
  getSpendingInsightsDef,
  getTransactionsSummaryDef,
  getWalletsDef,
  recordTransactionDef,
  searchTransactionsDef,
  updateTransactionDef,
  updateWalletDef,
} from "./definitions";

async function ensureCategoryForUser(
  userId: string,
  name: string,
  type: "income" | "expense",
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const defaults =
    type === "expense"
      ? (DEFAULT_EXPENSE_CATEGORIES as readonly string[])
      : (DEFAULT_INCOME_CATEGORIES as readonly string[]);

  const isDefault = defaults.some(
    (d) => d.toLowerCase() === trimmed.toLowerCase(),
  );
  if (isDefault) return;

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.type, type),
        ilike(categories.name, trimmed),
      ),
    );

  if (existing) return;

  await db.insert(categories).values({
    id: crypto.randomUUID(),
    userId,
    name: trimmed,
    type,
  });
}

function getTimeframeDates(timeframe?: string) {
  const tf = timeframe || "this_month";
  const now = new Date();
  let currentStart = new Date(0);
  let currentEnd = new Date(now);
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;

  if (tf === "this_week") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    currentStart = new Date(now);
    currentStart.setDate(now.getDate() + diffToMonday);
    currentStart.setHours(0, 0, 0, 0);

    prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - 7);
    prevEnd = new Date(currentStart);
    prevEnd.setMilliseconds(-1);
  } else if (tf === "this_month") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (tf === "last_month") {
    currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    currentEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );
    prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    prevEnd = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      0,
      23,
      59,
      59,
      999,
    );
  } else if (tf === "last_3_months") {
    currentStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    prevEnd = new Date(
      now.getFullYear(),
      now.getMonth() - 3,
      0,
      23,
      59,
      59,
      999,
    );
  } else if (tf === "this_year") {
    currentStart = new Date(now.getFullYear(), 0, 1);
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  }

  return { currentStart, currentEnd, prevStart, prevEnd };
}

export function createAiServerTools(userId: string) {
  const getWallets = getWalletsDef.server(async () => {
    const list = await db
      .select({
        id: paymentMethods.id,
        name: paymentMethods.name,
        type: paymentMethods.type,
        balance: paymentMethods.balance,
      })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .orderBy(desc(paymentMethods.createdAt));

    return { wallets: list };
  });

  const createWallet = createWalletDef.server(
    async ({ name, type, balance }) => {
      const [created] = await db
        .insert(paymentMethods)
        .values({
          id: crypto.randomUUID(),
          userId,
          name,
          type,
          balance: String(balance ?? 0),
        })
        .returning();

      invalidatePaymentMethodsCache();
      revalidatePath("/payments");
      revalidatePath("/");

      return {
        success: true,
        message: `Wallet "${created.name}" created successfully.`,
        wallet: created,
      };
    },
  );

  const updateWallet = updateWalletDef.server(
    async ({ id, name, type, balance }) => {
      const updateData: Partial<typeof paymentMethods.$inferInsert> = {};
      if (name !== undefined) updateData.name = name;
      if (type !== undefined) updateData.type = type;
      if (balance !== undefined) updateData.balance = String(balance);

      if (Object.keys(updateData).length === 0) {
        return { success: false, error: "No fields to update provided." };
      }

      const [updated] = await db
        .update(paymentMethods)
        .set(updateData)
        .where(
          and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)),
        )
        .returning();

      if (!updated) {
        return { success: false, error: "Wallet not found." };
      }

      invalidatePaymentMethodsCache();
      revalidatePath("/payments");
      revalidatePath("/");

      return {
        success: true,
        message: `Wallet "${updated.name}" updated successfully.`,
        wallet: updated,
      };
    },
  );

  const deleteWallet = deleteWalletDef.server(async ({ id }) => {
    const [deleted] = await db
      .delete(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
      .returning();

    if (!deleted) {
      return { success: false, error: "Wallet not found." };
    }

    invalidatePaymentMethodsCache();
    revalidatePath("/payments");
    revalidatePath("/transactions");
    revalidatePath("/");

    return {
      success: true,
      message: `Wallet "${deleted.name}" and associated transactions deleted.`,
    };
  });

  const getCategories = getCategoriesDef.server(async ({ type }) => {
    const defaults =
      type === "expense"
        ? [...DEFAULT_EXPENSE_CATEGORIES]
        : [...DEFAULT_INCOME_CATEGORIES];

    const custom = await db
      .select({ name: categories.name })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.type, type)))
      .orderBy(desc(categories.createdAt));

    const combined = Array.from(
      new Set([...defaults, ...custom.map((c) => c.name)]),
    );

    return { categories: combined };
  });

  const createCategory = createCategoryDef.server(async ({ name, type }) => {
    const trimmed = name.trim();
    const defaults =
      type === "expense"
        ? (DEFAULT_EXPENSE_CATEGORIES as readonly string[])
        : (DEFAULT_INCOME_CATEGORIES as readonly string[]);

    if (defaults.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      return {
        success: true,
        message: `Category "${trimmed}" already exists as a default ${type} category.`,
      };
    }

    const [existing] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          eq(categories.type, type),
          ilike(categories.name, trimmed),
        ),
      );

    if (existing) {
      return {
        success: true,
        message: `Category "${existing.name}" already exists.`,
      };
    }

    const [created] = await db
      .insert(categories)
      .values({
        id: crypto.randomUUID(),
        userId,
        name: trimmed,
        type,
      })
      .returning();

    return {
      success: true,
      message: `Category "${created.name}" created successfully.`,
      category: created,
    };
  });

  const getTransactionsSummary = getTransactionsSummaryDef.server(
    async ({ startDate, endDate, category }) => {
      const baseConditions = [eq(transactions.userId, userId)];

      if (startDate) {
        baseConditions.push(gte(transactions.date, new Date(startDate)));
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        baseConditions.push(lte(transactions.date, end));
      }
      if (category) {
        baseConditions.push(ilike(transactions.category, category.trim()));
      }

      const [incomeRow] = await db
        .select({
          total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(and(...baseConditions, eq(transactions.type, "income")));

      const [expenseRow] = await db
        .select({
          total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(and(...baseConditions, eq(transactions.type, "expense")));

      const totalIncome = Number(incomeRow?.total) || 0;
      const totalExpense = Number(expenseRow?.total) || 0;
      const netBalance = totalIncome - totalExpense;

      return { totalIncome, totalExpense, netBalance };
    },
  );

  const getRecentTransactions = getRecentTransactionsDef.server(
    async ({ limit, type, category }) => {
      const conditions = [eq(transactions.userId, userId)];
      if (type) conditions.push(eq(transactions.type, type));
      if (category)
        conditions.push(ilike(transactions.category, category.trim()));

      const toPaymentMethods = alias(paymentMethods, "to_payment_methods");

      const rows = await db
        .select({
          id: transactions.id,
          type: transactions.type,
          amount: transactions.amount,
          title: transactions.title,
          category: transactions.category,
          description: transactions.description,
          date: transactions.date,
          paymentMethodId: transactions.paymentMethodId,
          walletName: paymentMethods.name,
          walletType: paymentMethods.type,
          toPaymentMethodId: transactions.toPaymentMethodId,
          toWalletName: toPaymentMethods.name,
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
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit || 5);

      return { transactions: rows };
    },
  );

  const searchTransactions = searchTransactionsDef.server(async (input) => {
    const {
      query,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      paymentMethodId,
      category,
      type,
      limit,
    } = input;

    const conditions = [eq(transactions.userId, userId)];

    if (query?.trim()) {
      const q = `%${query.trim()}%`;
      const searchCondition = or(
        ilike(transactions.title, q),
        ilike(transactions.description, q),
        ilike(transactions.category, q),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (minAmount !== undefined) {
      conditions.push(
        sql`CAST(${transactions.amount} AS NUMERIC) >= ${minAmount}`,
      );
    }

    if (maxAmount !== undefined) {
      conditions.push(
        sql`CAST(${transactions.amount} AS NUMERIC) <= ${maxAmount}`,
      );
    }

    if (startDate) {
      conditions.push(gte(transactions.date, new Date(startDate)));
    }

    if (endDate) {
      const end = new Date(endDate);
      if (endDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
      conditions.push(lte(transactions.date, end));
    }

    if (paymentMethodId) {
      const pmCondition = or(
        eq(transactions.paymentMethodId, paymentMethodId),
        eq(transactions.toPaymentMethodId, paymentMethodId),
      );
      if (pmCondition) {
        conditions.push(pmCondition);
      }
    }

    if (category?.trim()) {
      conditions.push(ilike(transactions.category, category.trim()));
    }

    if (type) {
      conditions.push(eq(transactions.type, type));
    }

    const toPaymentMethods = alias(paymentMethods, "to_payment_methods");

    const rows = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        title: transactions.title,
        category: transactions.category,
        description: transactions.description,
        date: transactions.date,
        paymentMethodId: transactions.paymentMethodId,
        walletName: paymentMethods.name,
        walletType: paymentMethods.type,
        toPaymentMethodId: transactions.toPaymentMethodId,
        toWalletName: toPaymentMethods.name,
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
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(limit || 15);

    return {
      count: rows.length,
      transactions: rows,
    };
  });

  const getSpendingInsights = getSpendingInsightsDef.server(
    async ({ timeframe, type }) => {
      const selectedType = type || "expense";
      const { currentStart, currentEnd, prevStart, prevEnd } =
        getTimeframeDates(timeframe);

      // Current period total
      const currentConditions = [
        eq(transactions.userId, userId),
        eq(transactions.type, selectedType),
        gte(transactions.date, currentStart),
        lte(transactions.date, currentEnd),
      ];

      const [currentTotalRow] = await db
        .select({
          total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(and(...currentConditions));

      const totalCurrent = Number(currentTotalRow?.total) || 0;
      const countCurrent = Number(currentTotalRow?.count) || 0;

      // Category breakdown
      const categoryRows = await db
        .select({
          category: transactions.category,
          total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(and(...currentConditions))
        .groupBy(transactions.category)
        .orderBy(desc(sql`sum(${transactions.amount})`));

      const categoryBreakdown = categoryRows.map((r) => {
        const catTotal = Number(r.total) || 0;
        const percentage =
          totalCurrent > 0
            ? Number(((catTotal / totalCurrent) * 100).toFixed(1))
            : 0;
        return {
          category: r.category,
          total: catTotal,
          count: Number(r.count),
          percentage,
        };
      });

      // Previous period comparison if applicable
      let comparison: {
        previousTotal: number;
        changeAmount: number;
        percentageChange: number | null;
      } | null = null;

      if (prevStart && prevEnd) {
        const prevConditions = [
          eq(transactions.userId, userId),
          eq(transactions.type, selectedType),
          gte(transactions.date, prevStart),
          lte(transactions.date, prevEnd),
        ];

        const [prevTotalRow] = await db
          .select({
            total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
          })
          .from(transactions)
          .where(and(...prevConditions));

        const totalPrev = Number(prevTotalRow?.total) || 0;
        const changeAmount = totalCurrent - totalPrev;
        const percentageChange =
          totalPrev > 0
            ? Number(
                (((totalCurrent - totalPrev) / totalPrev) * 100).toFixed(1),
              )
            : null;

        comparison = {
          previousTotal: totalPrev,
          changeAmount,
          percentageChange,
        };
      }

      return {
        timeframe,
        type: selectedType,
        total: totalCurrent,
        transactionCount: countCurrent,
        categories: categoryBreakdown,
        comparison,
      };
    },
  );

  const deleteTransaction = deleteTransactionDef.server(async ({ id }) => {
    const result = await db.transaction(async (tx) => {
      const [txRecord] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

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
              eq(paymentMethods.userId, userId),
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
                eq(paymentMethods.userId, userId),
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
              eq(paymentMethods.userId, userId),
            ),
          );

        if (wallet) {
          const currentBal = Number(wallet.balance) || 0;
          const revertedBal =
            txRecord.type === "income"
              ? currentBal - amount
              : currentBal + amount;

          await tx
            .update(paymentMethods)
            .set({ balance: String(revertedBal) })
            .where(eq(paymentMethods.id, wallet.id));
        }
      }

      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, txRecord.id),
            eq(transactions.userId, userId),
          ),
        );

      return { success: true };
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    invalidatePaymentMethodsCache();
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath("/payments");

    return {
      success: true,
      message: `Transaction ${id} deleted and wallet balances restored.`,
    };
  });

  const updateTransaction = updateTransactionDef.server(async (input) => {
    const {
      id,
      type,
      amount,
      title,
      paymentMethodId,
      toPaymentMethodId,
      category,
      description,
      date,
    } = input;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

      if (!existing) {
        return { error: "Transaction not found" };
      }

      // Revert previous wallet balance adjustment
      const oldAmount = Number(existing.amount) || 0;
      if (existing.type === "transfer") {
        const [oldSrc] = await tx
          .select()
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.id, existing.paymentMethodId),
              eq(paymentMethods.userId, userId),
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
                eq(paymentMethods.userId, userId),
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
              eq(paymentMethods.userId, userId),
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

      const newType = type ?? existing.type;
      const newAmount = amount ?? Number(existing.amount);
      const newSrcId = paymentMethodId ?? existing.paymentMethodId;
      const newDestId =
        newType === "transfer"
          ? toPaymentMethodId !== undefined
            ? toPaymentMethodId
            : existing.toPaymentMethodId
          : null;

      if (newType === "transfer" && newSrcId === newDestId) {
        return {
          error:
            "Source and destination wallets must be different for transfers.",
        };
      }

      const [newSrc] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, newSrcId),
            eq(paymentMethods.userId, userId),
          ),
        );

      if (!newSrc) {
        return { error: "Source wallet not found" };
      }

      if (newType === "transfer") {
        if (!newDestId) {
          return { error: "Destination wallet required for transfer" };
        }
        const [newDest] = await tx
          .select()
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.id, newDestId),
              eq(paymentMethods.userId, userId),
            ),
          );

        if (!newDest) {
          return { error: "Destination wallet not found" };
        }

        const srcBal = Number(newSrc.balance) || 0;
        const destBal = Number(newDest.balance) || 0;

        await tx
          .update(paymentMethods)
          .set({ balance: String(srcBal - newAmount) })
          .where(eq(paymentMethods.id, newSrc.id));

        await tx
          .update(paymentMethods)
          .set({ balance: String(destBal + newAmount) })
          .where(eq(paymentMethods.id, newDest.id));
      } else {
        const curBal = Number(newSrc.balance) || 0;
        const nextBal =
          newType === "income" ? curBal + newAmount : curBal - newAmount;

        await tx
          .update(paymentMethods)
          .set({ balance: String(nextBal) })
          .where(eq(paymentMethods.id, newSrc.id));
      }

      const finalCategory =
        newType === "transfer"
          ? "Transfer"
          : (category?.trim() ?? existing.category);
      const finalTitle = title !== undefined ? title.trim() : existing.title;
      const finalDate = date ? new Date(date) : existing.date;

      const [updated] = await tx
        .update(transactions)
        .set({
          paymentMethodId: newSrcId,
          toPaymentMethodId: newDestId,
          type: newType,
          amount: String(newAmount),
          title: finalTitle,
          category: finalCategory,
          description:
            description !== undefined ? description : existing.description,
          date: finalDate,
        })
        .where(eq(transactions.id, existing.id))
        .returning();

      return {
        transaction: updated,
        type: newType,
        category: finalCategory,
      };
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (result.type !== "transfer" && result.category) {
      await ensureCategoryForUser(
        userId,
        result.category,
        result.type as "income" | "expense",
      );
    }

    invalidatePaymentMethodsCache();
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath("/payments");

    return {
      success: true,
      message: `Transaction ${id} updated successfully.`,
      transaction: result.transaction,
    };
  });

  const recordTransaction = recordTransactionDef.server(async (input) => {
    const {
      type,
      amount,
      title,
      paymentMethodId,
      toPaymentMethodId,
      category,
      description,
      date,
    } = input;

    if (type === "transfer" && paymentMethodId === toPaymentMethodId) {
      return {
        success: false,
        error:
          "Source and destination wallets must be different for transfers.",
      };
    }

    const txDate = date ? new Date(date) : new Date();

    const result = await db.transaction(async (tx) => {
      const [sourceWallet] = await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, paymentMethodId),
            eq(paymentMethods.userId, userId),
          ),
        );

      if (!sourceWallet) {
        return { error: "Source wallet not found" };
      }

      if (type === "transfer") {
        if (!toPaymentMethodId) {
          return { error: "Destination wallet required for transfer" };
        }
        const [destWallet] = await tx
          .select()
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.id, toPaymentMethodId),
              eq(paymentMethods.userId, userId),
            ),
          );

        if (!destWallet) {
          return { error: "Destination wallet not found" };
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
        const currentBal = Number(sourceWallet.balance) || 0;
        const newBal =
          type === "income" ? currentBal + amount : currentBal - amount;

        await tx
          .update(paymentMethods)
          .set({ balance: String(newBal) })
          .where(eq(paymentMethods.id, sourceWallet.id));
      }

      const finalCategory =
        type === "transfer" ? "Transfer" : category?.trim() || "Other";
      const finalTitle =
        type === "transfer"
          ? title || "Wallet Transfer"
          : title || finalCategory;

      const [created] = await tx
        .insert(transactions)
        .values({
          id: crypto.randomUUID(),
          userId,
          paymentMethodId,
          toPaymentMethodId: type === "transfer" ? toPaymentMethodId : null,
          type,
          amount: String(amount),
          title: finalTitle,
          category: finalCategory,
          description: description || null,
          date: txDate,
        })
        .returning();

      return { transaction: created };
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (type !== "transfer" && category) {
      await ensureCategoryForUser(userId, category, type);
    }

    invalidatePaymentMethodsCache();
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath("/payments");

    return {
      success: true,
      message: `Transaction "${title}" recorded successfully.`,
      transaction: result.transaction,
    };
  });

  return [
    getWallets,
    createWallet,
    updateWallet,
    deleteWallet,
    getTransactionsSummary,
    getRecentTransactions,
    searchTransactions,
    getSpendingInsights,
    getCategories,
    createCategory,
    deleteTransaction,
    updateTransaction,
    recordTransaction,
  ];
}
