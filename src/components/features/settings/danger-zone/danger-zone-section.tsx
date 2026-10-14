import { DeleteAccountAction } from "./delete-account-action";
import { ResetTransactionsAction } from "./reset-transactions-action";

export function DangerZoneSection() {
  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="space-y-1">
        <h2 className="font-semibold text-destructive text-lg">Danger Zone</h2>
        <p className="text-muted-foreground text-sm">
          Irreversible and destructive actions. Proceed with caution.
        </p>
      </div>

      <div className="mt-6 space-y-4 border-destructive/20 border-t pt-4">
        <ResetTransactionsAction />
        <div className="border-destructive/10 border-t" />
        <DeleteAccountAction />
      </div>
    </section>
  );
}
