import { getCategories } from "./actions";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "./data";

const categoryCache: {
  expense?: string[];
  income?: string[];
} = {};

const inFlightCategories: {
  expense?: Promise<string[]>;
  income?: Promise<string[]>;
} = {};

export function getCachedCategoriesSync(type: "income" | "expense"): string[] {
  if (categoryCache[type]) {
    return categoryCache[type];
  }
  return type === "expense"
    ? [...DEFAULT_EXPENSE_CATEGORIES]
    : [...DEFAULT_INCOME_CATEGORIES];
}

export async function fetchCategoriesWithCache(
  type: "income" | "expense",
  forceRefresh = false,
): Promise<string[]> {
  if (!forceRefresh && categoryCache[type]) {
    return categoryCache[type];
  }
  if (!forceRefresh && inFlightCategories[type]) {
    return inFlightCategories[type];
  }

  inFlightCategories[type] = getCategories(type)
    .then((res) => {
      const data = res.data ?? getCachedCategoriesSync(type);
      categoryCache[type] = data;
      return data;
    })
    .finally(() => {
      delete inFlightCategories[type];
    });

  return inFlightCategories[type];
}

export function invalidateCategoriesCache(type?: "income" | "expense") {
  if (type) {
    delete categoryCache[type];
  } else {
    delete categoryCache.expense;
    delete categoryCache.income;
  }
}
