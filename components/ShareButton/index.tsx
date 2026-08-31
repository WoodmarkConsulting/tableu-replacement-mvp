"use client";

import { CheckIcon, Share2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useShareFilters } from "@/hooks/useShareFilters";

type ShareButtonProps = {
  dashboard: string;
};

export function ShareButton({ dashboard }: ShareButtonProps) {
  const { share, status } = useShareFilters(dashboard);

  const label =
    status === "copied"
      ? "Link kopiert"
      : status === "error"
        ? "Fehler"
        : "Teilen";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={share}
      disabled={status === "sharing"}>
      {status === "copied" ? (
        <CheckIcon className="mr-2 size-4" />
      ) : (
        <Share2Icon className="mr-2 size-4" />
      )}

      {label}
    </Button>
  );
}
