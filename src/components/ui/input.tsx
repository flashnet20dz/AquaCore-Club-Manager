import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const isDateType = type === "date" || type === "time" || type === "datetime-local";
  return (
    <input
      type={type}
      data-slot="input"
      lang={isDateType ? (props.lang || "fr-DZ") : props.lang}
      dir={isDateType && !props.dir ? "ltr" : props.dir}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-border/80 flex h-[38px] w-full min-w-0 rounded-near-sm border bg-card px-3 py-1 text-sm shadow-2xs motion-fast transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        isDateType && "font-mono-data tabular-nums text-start",
        "focus-visible:border-saas-primary focus-visible:ring-saas-primary/30 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
