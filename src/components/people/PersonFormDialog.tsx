import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { useRefreshSpace, type Person } from "@/hooks/useSpaceData";
import { createPerson, updatePerson } from "@/lib/mutations";
import { errorMessage } from "@/lib/db";
import { cn } from "@/lib/utils";

interface PersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceName: string;
  /** null = add someone new */
  person: Person | null;
  existingNames: string[];
}

export const PersonFormDialog = ({
  open,
  onOpenChange,
  spaceId,
  spaceName,
  person,
  existingNames,
}: PersonFormDialogProps) => {
  const refreshSpace = useRefreshSpace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(person?.name ?? "");
    setEmail(person?.email ?? "");
    setPhone(person?.phone ?? "");
    setError(null);
  }, [open, person]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name.");
      nameRef.current?.focus();
      return;
    }
    const duplicate = existingNames.some(
      (n) => n.toLowerCase() === trimmed.toLowerCase() && n !== person?.name
    );
    if (duplicate) {
      setError(`There's already someone called ${trimmed} here. Add a surname or initial so balances stay clear.`);
      nameRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const draft = { name: trimmed, email: email.trim() || null, phone: phone.trim() || null };
      if (person) {
        await updatePerson(person.id, draft);
        toast.success("Saved", { description: trimmed });
      } else {
        await createPerson(spaceId, draft);
        toast.success(`Added ${trimmed}`, { description: `to ${spaceName}` });
      }
      await refreshSpace(spaceId);
      onOpenChange(false);
    } catch (err) {
      toast.error(person ? "Couldn't save changes" : "Couldn't add this person", {
        description: errorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{person ? `Edit ${person.name}` : "Add a person"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {person ? "Changes show up everywhere this person appears." : `They'll be available to split with in ${spaceName}.`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <form id="person-form" onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="person-name">Name</Label>
              <Input
                ref={nameRef}
                id="person-name"
                autoFocus
                autoComplete="off"
                maxLength={60}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Priya"
                aria-invalid={!!error}
                aria-describedby={error ? "person-name-error" : undefined}
                className={cn("h-11", error && "border-debit")}
              />
              {error && (
                <p id="person-name-error" className="text-sm text-debit">
                  {error}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="person-email">
                  Email <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="person-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="person-phone">
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="person-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </form>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="hidden sm:inline-flex">
            Cancel
          </Button>
          <Button type="submit" form="person-form" disabled={saving} className="h-11 sm:h-10">
            {saving && <Loader2 className="animate-spin" />}
            {person ? "Save" : "Add person"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
