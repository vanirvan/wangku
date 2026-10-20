import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

export const getWalletsDef = toolDefinition({
  name: "get_wallets",
  description:
    "Get all available payment methods (wallets, bank accounts, cash, cards) with their IDs, names, and current balances.",
  inputSchema: z.object({}),
});

export const createWalletDef = toolDefinition({
  name: "create_wallet",
  description:
    "Create a new wallet or payment method (e.g. Bank Account, Cash, E-Wallet, Card).",
  inputSchema: z.object({
    name: z.string().trim().min(1, "Name is required").max(50),
    type: z.enum(["cash", "bank", "ewallet", "card", "other"]),
    balance: z.number().min(0, "Balance cannot be negative").default(0),
  }),
});

export const updateWalletDef = toolDefinition({
  name: "update_wallet",
  description:
    "Update an existing wallet (rename, change type, or set balance). Match ID using get_wallets first.",
  inputSchema: z.object({
    id: z.string().min(1, "Wallet ID is required"),
    name: z.string().trim().min(1).max(50).optional(),
    type: z.enum(["cash", "bank", "ewallet", "card", "other"]).optional(),
    balance: z.number().min(0, "Balance cannot be negative").optional(),
  }),
});

export const deleteWalletDef = toolDefinition({
  name: "delete_wallet",
  description:
    "Delete a wallet/payment method by ID. Warning: also deletes all transactions linked to this wallet.",
  inputSchema: z.object({
    id: z.string().min(1, "Wallet ID is required"),
  }),
});

export const getTransactionsSummaryDef = toolDefinition({
  name: "get_transactions_summary",
  description:
    "Get the total financial summary including total income, total expense, and net balance. Can be optionally filtered by date range or category.",
  inputSchema: z.object({
    startDate: z
      .string()
      .optional()
      .describe("Start date in ISO format (YYYY-MM-DD or full timestamp)"),
    endDate: z
      .string()
      .optional()
      .describe("End date in ISO format (YYYY-MM-DD or full timestamp)"),
    category: z.string().optional().describe("Optional category to filter by"),
  }),
});

export const getRecentTransactionsDef = toolDefinition({
  name: "get_recent_transactions",
  description:
    "Get recent transaction history with optional limit, type, or category filter. Each transaction includes paymentMethodId, walletName, walletType, and destination wallet info for transfers.",
  inputSchema: z.object({
    limit: z.number().optional().default(5),
    type: z.enum(["income", "expense", "transfer"]).optional(),
    category: z.string().optional().describe("Filter by category name"),
  }),
});

export const getCategoriesDef = toolDefinition({
  name: "get_categories",
  description:
    "Get all available transaction categories (both default and user-defined) for income or expense.",
  inputSchema: z.object({
    type: z
      .enum(["income", "expense"])
      .describe("Type of categories to retrieve"),
  }),
});

export const createCategoryDef = toolDefinition({
  name: "create_category",
  description:
    "Create a new custom income or expense category for future transactions.",
  inputSchema: z.object({
    name: z.string().trim().min(1, "Category name is required").max(50),
    type: z
      .enum(["income", "expense"])
      .describe("Type of category (income or expense)"),
  }),
});

export const searchTransactionsDef = toolDefinition({
  name: "search_transactions",
  description:
    "Search transactions using multi-criteria filters (keyword in title/description, amount range, date range, wallet, category, type).",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Text keyword to search in title or description"),
    minAmount: z.number().positive().optional().describe("Minimum amount"),
    maxAmount: z.number().positive().optional().describe("Maximum amount"),
    startDate: z
      .string()
      .optional()
      .describe("Start date in ISO format (YYYY-MM-DD)"),
    endDate: z
      .string()
      .optional()
      .describe("End date in ISO format (YYYY-MM-DD)"),
    paymentMethodId: z
      .string()
      .optional()
      .describe("Filter by specific wallet ID"),
    category: z.string().optional().describe("Filter by category name"),
    type: z.enum(["income", "expense", "transfer"]).optional(),
    limit: z.number().min(1).max(50).optional().default(15),
  }),
});

export const getSpendingInsightsDef = toolDefinition({
  name: "get_spending_insights",
  description:
    "Get aggregated spending breakdown and analytics (e.g. category breakdown percentages, period-over-period comparison) for a timeframe.",
  inputSchema: z.object({
    timeframe: z
      .enum([
        "this_week",
        "this_month",
        "last_month",
        "last_3_months",
        "this_year",
        "all_time",
      ])
      .default("this_month"),
    type: z
      .enum(["expense", "income"])
      .optional()
      .default("expense")
      .describe("Whether to analyze expenses or income (defaults to expense)"),
  }),
});

export const deleteTransactionDef = toolDefinition({
  name: "delete_transaction",
  description:
    "Delete a transaction by its ID and restore affected wallet balances.",
  inputSchema: z.object({
    id: z.string().min(1, "Transaction ID is required"),
  }),
});

export const updateTransactionDef = toolDefinition({
  name: "update_transaction",
  description:
    "Update an existing transaction (modify amount, title, type, category, date, or wallets) and recalculate affected wallet balances automatically.",
  inputSchema: z.object({
    id: z.string().min(1, "Transaction ID is required"),
    type: z.enum(["income", "expense", "transfer"]).optional(),
    amount: z.number().positive("Amount must be greater than 0").optional(),
    title: z.string().min(1).optional(),
    paymentMethodId: z.string().optional().describe("Source wallet ID"),
    toPaymentMethodId: z
      .string()
      .optional()
      .describe("Destination wallet ID (for transfer)"),
    category: z.string().optional().describe("Category name"),
    description: z.string().optional().describe("Optional note/description"),
    date: z
      .string()
      .optional()
      .describe("Transaction date in ISO format (e.g. YYYY-MM-DD)"),
  }),
});

export const recordTransactionDef = toolDefinition({
  name: "record_transaction",
  description:
    "Record a new transaction. Note: 'transfer' type is strictly for internal transfers between the user's own wallets (requires toPaymentMethodId). Sending money to other people, family, or bills is an 'expense'.",
  inputSchema: z.object({
    type: z
      .enum(["income", "expense", "transfer"])
      .describe(
        "Transaction type: 'income', 'expense', or 'transfer' (internal between own wallets only)",
      ),
    amount: z.number().positive("Amount must be greater than 0"),
    title: z.string().min(1, "Title is required"),
    paymentMethodId: z
      .string()
      .min(1, "Payment method / source wallet ID is required"),
    toPaymentMethodId: z
      .string()
      .optional()
      .describe(
        "Destination wallet ID (only required if type is internal transfer)",
      ),
    category: z.string().optional().describe("Category name"),
    description: z.string().optional().describe("Optional note/description"),
    date: z
      .string()
      .optional()
      .describe(
        "Transaction date in ISO format (e.g. YYYY-MM-DD). Defaults to current time if omitted.",
      ),
  }),
});
