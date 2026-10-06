import { TriangleAlert } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  id: string
  label: string
  error?: string
  warning?: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

/** Etichetta + controllo + messaggio (errore bloccante o avviso di plausibilità). */
export function FormField({ id, label, error, warning, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : warning ? (
        <p id={`${id}-msg`} className="flex items-start gap-1 text-xs text-warn">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          {warning}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  )
}

interface NumberInputProps extends Omit<ComponentProps<"input">, "type"> {
  unit?: string
  invalid?: boolean
  warned?: boolean
}

/**
 * Input numerico "italiano": type=text + inputMode=decimal per accettare la virgola
 * e mostrare il tastierino numerico su smartphone.
 */
export function NumberInput({ unit, invalid, warned, className, id, ...props }: NumberInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid || warned ? `${id}-msg` : undefined}
        className={cn(
          "h-10 rounded-lg tabular",
          unit && "pr-12",
          warned && !invalid && "border-warn/60 focus-visible:border-warn focus-visible:ring-warn/30",
          className,
        )}
        {...props}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  )
}

export function FormSection({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="grid size-7 place-items-center rounded-lg bg-neon/10 text-neon ring-1 ring-inset ring-neon/25 [&_svg]:size-3.5">
              {icon}
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
