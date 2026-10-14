"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteUser } from "@/lib/auth/auth-client";

export function DeleteAccountAction() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deleteUser();
      if (res?.error) {
        setError(res.error.message || "Failed to delete account");
        setLoading(false);
        return;
      }
      setOpen(false);
      router.push("/sign-in");
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">Delete Account</p>
        <p className="text-muted-foreground text-xs">
          Permanently remove your account, authentication credentials, and all
          stored data.
        </p>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your
              account, remove your authentication credentials, and purge all
              financial data and transactions from our servers.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" size="sm" disabled={loading}>
                  Cancel
                </Button>
              }
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={loading}
              onClick={handleDelete}
            >
              {loading ? "Deleting..." : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
