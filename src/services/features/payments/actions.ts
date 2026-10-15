"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentMethods } from "@/lib/db/schemas/payment-methods-schema";

import {
  type PaymentMethodFormValues as PaymentMethodInput,
  paymentMethodSchema,
} from "./schema";

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

export async function getPaymentMethods() {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const data = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, user.id))
    .orderBy(desc(paymentMethods.createdAt));

  return { data };
}

export async function createPaymentMethod(data: PaymentMethodInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = paymentMethodSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [created] = await db
    .insert(paymentMethods)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      balance: String(parsed.data.balance),
    })
    .returning();

  revalidatePath("/payments");
  return { data: created };
}

export async function updatePaymentMethod(
  id: string,
  data: PaymentMethodInput,
) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = paymentMethodSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [updated] = await db
    .update(paymentMethods)
    .set({
      name: parsed.data.name,
      type: parsed.data.type,
      balance: String(parsed.data.balance),
    })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)))
    .returning();

  if (!updated) return { error: "Payment method not found" };

  revalidatePath("/payments");
  return { data: updated };
}

export async function deletePaymentMethod(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const [deleted] = await db
    .delete(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)))
    .returning();

  if (!deleted) return { error: "Payment method not found" };

  revalidatePath("/payments");
  return { success: true };
}
