import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky action row (buttons). */
  footer?: React.ReactNode;
  /** Element to focus when opening; defaults to the first field. */
  initialFocus?: React.RefObject<HTMLElement>;
  className?: string;
}

/**
 * A bottom sheet on phones, a centred dialog from md up. Header and footer stay
 * put while the body scrolls, so the primary action is always reachable.
 */
export const ResponsiveDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  initialFocus,
  className,
}: ResponsiveDialogProps) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/35 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        onOpenAutoFocus={(e) => {
          if (initialFocus?.current) {
            e.preventDefault();
            initialFocus.current.focus();
          }
        }}
        className={cn(
          "fixed z-50 flex flex-col bg-card text-card-foreground shadow-[0_-8px_30px_-12px_hsl(24_10%_10%/0.25)] outline-none duration-200",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[86vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:shadow-[0_24px_60px_-20px_hsl(24_10%_10%/0.35)]",
          "md:data-[state=open]:fade-in-0 md:data-[state=open]:zoom-in-95 md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]",
          "md:data-[state=closed]:fade-out-0 md:data-[state=closed]:zoom-out-95 md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%]",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 md:px-6">
          <div className="min-w-0 space-y-1">
            <DialogPrimitive.Title className="text-lg font-semibold leading-tight">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="-mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6">{children}</div>
        {footer && (
          <div className="border-t bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:rounded-b-xl md:px-6">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);
