import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Mail, Loader2, Users, FileText } from "lucide-react";

interface Flatmate {
  id: string;
  name: string;
  email: string | null;
}

interface EmailReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flatmates: Flatmate[];
  onSendEmail: (
    recipients: string[],
    emailType: "individual" | "comprehensive"
  ) => Promise<void>;
}

const EmailReportDialog = ({
  open,
  onOpenChange,
  flatmates,
  onSendEmail,
}: EmailReportDialogProps) => {
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [emailType, setEmailType] = useState<"individual" | "comprehensive">(
    "comprehensive"
  );
  const [sending, setSending] = useState(false);

  const flatmatesWithEmails = flatmates.filter((flatmate) => flatmate.email);

  const handleRecipientChange = (flatmateId: string, checked: boolean) => {
    if (checked) {
      setSelectedRecipients((prev) => [...prev, flatmateId]);
    } else {
      setSelectedRecipients((prev) => prev.filter((id) => id !== flatmateId));
    }
  };

  const handleSelectAll = () => {
    if (selectedRecipients.length === flatmatesWithEmails.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(flatmatesWithEmails.map((f) => f.id));
    }
  };

  const handleSendEmail = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setSending(true);
    try {
      await onSendEmail(selectedRecipients, emailType);
      onOpenChange(false);
      setSelectedRecipients([]);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const resetDialog = () => {
    setSelectedRecipients([]);
    setEmailType("comprehensive");
    setSending(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetDialog();
      }}
    >
      <DialogContent className="glass-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2 text-primary" />
            Send Settlement Report
          </DialogTitle>
          <DialogDescription>
            Send settlement reports to selected flatmates via email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Email Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Email Type</Label>
            <RadioGroup
              value={emailType}
              onValueChange={(value: "individual" | "comprehensive") =>
                setEmailType(value)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="comprehensive" id="comprehensive" />
                <Label
                  htmlFor="comprehensive"
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-primary" />
                    <div>
                      <div className="font-medium">Comprehensive Report</div>
                      <div className="text-sm text-muted-foreground">
                        Send complete report to all selected members
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="flex-1 cursor-pointer">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-primary" />
                    <div>
                      <div className="font-medium">Individual Reports</div>
                      <div className="text-sm text-muted-foreground">
                        Send personalized summary to each member
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Recipients Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Recipients</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={flatmatesWithEmails.length === 0}
              >
                {selectedRecipients.length === flatmatesWithEmails.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            {flatmatesWithEmails.length === 0 ? (
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="p-4">
                  <div className="text-center">
                    <Mail className="w-8 h-8 mx-auto text-destructive mb-2" />
                    <p className="text-sm text-destructive font-medium">
                      No flatmates with email addresses
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please add email addresses to flatmates first
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-secondary/30 rounded-lg border border-border/50">
                {flatmatesWithEmails.map((flatmate) => (
                  <div
                    key={flatmate.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`recipient-${flatmate.id}`}
                      checked={selectedRecipients.includes(flatmate.id)}
                      onCheckedChange={(checked) =>
                        handleRecipientChange(flatmate.id, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`recipient-${flatmate.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      <div>
                        <div className="font-medium">{flatmate.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {flatmate.email}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedRecipients.length > 0 && (
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="text-sm">
                  <div className="font-medium text-primary mb-1">
                    Email Summary
                  </div>
                  <div className="text-muted-foreground">
                    <div>
                      •{" "}
                      {emailType === "comprehensive"
                        ? "Comprehensive report"
                        : "Individual reports"}
                    </div>
                    <div>
                      • {selectedRecipients.length} recipient
                      {selectedRecipients.length > 1 ? "s" : ""}
                    </div>
                    <div>
                      •{" "}
                      {emailType === "individual"
                        ? "Personalized for each member"
                        : "Same report for all"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={
                selectedRecipients.length === 0 ||
                flatmatesWithEmails.length === 0 ||
                sending
              }
              className="flex-1 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email{selectedRecipients.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReportDialog;
