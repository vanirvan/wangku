"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface EditCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string | null;
  onSave: (newName: string) => Promise<{ error?: string } | void>;
}

export function EditCategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: EditCategoryDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && category) {
      setName(category);
      setError(null);
      setLoading(false);
    }
  }, [open, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === category) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await onSave(trimmed);
      if (res && "error" in res && res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to rename category",
      );
      setLoading(false);
    }
  };

  const isUnchanged = name.trim() === category;
  const isEmpty = !name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-w-xs sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Edit Category
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enter a new name for this category.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Category name"
              disabled={loading}
              className="h-8 flex-1 text-xs"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || isEmpty || isUnchanged}
              className="h-8 shrink-0 text-xs"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </div>

          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
