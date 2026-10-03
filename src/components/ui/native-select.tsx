import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A styled native <select>. Used in forms so the value is submitted with
 * FormData without extra wiring.
 */
export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}
