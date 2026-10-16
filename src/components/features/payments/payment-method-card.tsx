import {
  Banknote,
  Building2,
  CircleDollarSign,
  CreditCard,
  Smartphone,
} from "lucide-react";
import type { ElementType } from "react";

import type { PaymentMethod } from "@/lib/db/schemas";
import { formatRupiah } from "@/lib/utils";
import type { PaymentMethodType } from "@/services/features/payments";

export const PAYMENT_TYPE_CONFIG: Record<
  PaymentMethodType,
  {
    label: string;
    icon: ElementType;
  }
> = {
  cash: {
    label: "Cash",
    icon: Banknote,
  },
  bank: {
    label: "Bank",
    icon: Building2,
  },
  ewallet: {
    label: "E-Wallet",
    icon: Smartphone,
  },
  card: {
    label: "Card",
    icon: CreditCard,
  },
  other: {
    label: "Other",
    icon: CircleDollarSign,
  },
};

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
  onEdit?: (paymentMethod: PaymentMethod) => void;
}

export function PaymentMethodCard({
  paymentMethod,
  onEdit,
}: PaymentMethodCardProps) {
  const typeKey =
    (paymentMethod.type as PaymentMethodType) in PAYMENT_TYPE_CONFIG
      ? (paymentMethod.type as PaymentMethodType)
      : "other";

  const config = PAYMENT_TYPE_CONFIG[typeKey];
  const Icon = config.icon;

  const formattedBalance = formatRupiah(paymentMethod.balance);

  const nameId = `wallet-name-${paymentMethod.id}`;
  const balanceId = `wallet-bal-${paymentMethod.id}`;

  return (
    // biome-ignore lint/a11y/useSemanticElements: Accessible card container acting as a composite button
    <div
      role="button"
      tabIndex={0}
      aria-labelledby={nameId}
      aria-describedby={balanceId}
      onClick={() => onEdit?.(paymentMethod)}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onEdit?.(paymentMethod);
        }
      }}
      className="group relative flex w-full cursor-pointer flex-col justify-between gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30 hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground transition-colors group-hover:bg-muted">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p
              id={nameId}
              className="truncate font-semibold text-base capitalize text-foreground"
            >
              {paymentMethod.name}
            </p>
            <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
              {config.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex w-full items-baseline justify-between gap-2 border-border/50 border-t pt-3">
        <p
          id={balanceId}
          className="font-mono font-semibold text-foreground text-lg tracking-tight"
        >
          {formattedBalance}
        </p>
      </div>
    </div>
  );
}
