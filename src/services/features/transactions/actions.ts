"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories, paymentMethods, transactions } from "@/lib/db/schemas";
import { ensureCustomCategory } from "@/services/features/categories";

import { type TransactionFormValues, transactionSchema } from "./schema";
import type {
  GetTransactionsFilter,
  TransactionWithPaymentMethod,
} from "./types";

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

export async function getTransactions(filter?: GetTransactionsFilter) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized", data: [] };

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

export async function createTransaction(data: TransactionFormValues) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

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
) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

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

export async function deleteTransaction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

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

export async function getTransactionSummary() {
  const user = await getSessionUser();
  if (!user) {
    return {
      data: { totalIncome: 0, totalExpense: 0, netBalance: 0 },
    };
  }

  const [incomeRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(eq(transactions.userId, user.id), eq(transactions.type, "income")),
    );

  const [expenseRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(eq(transactions.userId, user.id), eq(transactions.type, "expense")),
    );

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

export async function resetTransactions() {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

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
