import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Pinned below the scrolling body (primary actions). */
  footer?: ReactNode;
  className?: string;
}

/** Bottom sheet on phones, centred dialog from 768px up. */
export const ResponsiveModal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveModalProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[94dvh] bg-card">
          <DrawerHeader className="px-5 pb-2 pt-3 text-left">
            <DrawerTitle className="text-lg font-semibold tracking-tight">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">{title}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-4", className)}>{children}</div>
          {footer && <div className="border-t bg-card px-5 pb-safe pt-3">{footer}<div className="h-3" /></div>}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-3 pt-6 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-5", className)}>{children}</div>
        {footer && <div className="border-t bg-card px-6 py-4">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
};
