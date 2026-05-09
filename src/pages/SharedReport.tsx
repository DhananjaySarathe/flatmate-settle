import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, Receipt, AlertTriangle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportSnapshot, SnapshotBalance } from "@/lib/settlement";

interface SharedRow {
  split_space_name: string;
  from_date: string;
  to_date: string;
  snapshot: ReportSnapshot;
  created_at: string;
}

const formatINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadge = (status: SnapshotBalance["status"]) => {
  if (status === "settled")
    return <Badge variant="secondary">Settled</Badge>;
  if (status === "owes") return <Badge>Is Owed</Badge>;
  return <Badge variant="destructive">Owes</Badge>;
};

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<SharedRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("shared_reports")
        .select("split_space_name, from_date, to_date, snapshot, created_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setRow(data as unknown as SharedRow);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
              Link not found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This shared report doesn't exist or has been removed.
            </p>
            <Button asChild variant="outline">
              <Link to="/auth">Go to ExpenseWaale</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { snapshot } = row;

  const personNames = useMemo(() => {
    const names = new Set<string>();
    snapshot.balances.forEach((b) => names.add(b.name));
    snapshot.expenses.forEach((e) => {
      names.add(e.paidBy);
      e.splitBetween.forEach((n) => names.add(n));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [snapshot]);

  const activePerson =
    selectedPerson && personNames.includes(selectedPerson)
      ? selectedPerson
      : personNames[0] ?? null;

  const personData = useMemo(() => {
    if (!activePerson) return null;
    const balance = snapshot.balances.find((b) => b.name === activePerson);
    const paidByThem = snapshot.expenses.filter((e) => e.paidBy === activePerson);
    const owesShareIn = snapshot.expenses.filter(
      (e) => e.paidBy !== activePerson && e.splitBetween.includes(activePerson)
    );
    return { balance, paidByThem, owesShareIn };
  }, [activePerson, snapshot]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {snapshot.splitSpaceName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">
              {format(new Date(snapshot.dateRange.from), "MMM d, yyyy")} –{" "}
              {format(new Date(snapshot.dateRange.to), "MMM d, yyyy")}
            </Badge>
            <span>
              Generated {format(new Date(snapshot.generatedAt), "MMM d, yyyy h:mm a")}
            </span>
          </div>
        </div>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4 sm:inline-flex h-auto sm:h-10">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="settlements">Settlements</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="by-person">By Person</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">
                  Balance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.balances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No balances.</p>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <table className="w-full border-collapse min-w-[560px] sm:min-w-0">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 text-xs sm:text-sm">Name</th>
                          <th className="text-right p-2 text-xs sm:text-sm">Paid</th>
                          <th className="text-right p-2 text-xs sm:text-sm">Owed</th>
                          <th className="text-right p-2 text-xs sm:text-sm">Net</th>
                          <th className="text-right p-2 text-xs sm:text-sm">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.balances.map((b) => (
                          <tr key={b.name} className="border-b last:border-0">
                            <td className="p-2 text-sm font-medium">{b.name}</td>
                            <td className="p-2 text-sm text-right">
                              {formatINR(b.totalPaid)}
                            </td>
                            <td className="p-2 text-sm text-right">
                              {formatINR(b.totalOwed)}
                            </td>
                            <td
                              className={
                                "p-2 text-sm text-right font-medium " +
                                (b.balance > 0.01
                                  ? "text-green-600"
                                  : b.balance < -0.01
                                  ? "text-red-600"
                                  : "")
                              }
                            >
                              {b.balance >= 0 ? "+" : "-"}
                              {formatINR(Math.abs(b.balance))}
                            </td>
                            <td className="p-2 text-right">
                              {statusBadge(b.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settlements">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">
                  Settlement Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.settlements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All settled up — no transactions needed.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {snapshot.settlements.map((s, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-3 p-3 rounded-md border border-border/50 bg-secondary/20"
                      >
                        <div className="text-sm">
                          <span className="font-medium">{s.from}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">{s.to}</span>
                        </div>
                        <div className="text-sm font-semibold">
                          {formatINR(s.amount)}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                  All Expenses ({snapshot.expenses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No expenses in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <table className="w-full border-collapse min-w-[700px] sm:min-w-0">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 text-xs sm:text-sm">Date</th>
                          <th className="text-left p-2 text-xs sm:text-sm">Title</th>
                          <th className="text-left p-2 text-xs sm:text-sm">Paid By</th>
                          <th className="text-left p-2 text-xs sm:text-sm">Split Between</th>
                          <th className="text-right p-2 text-xs sm:text-sm">Per Person</th>
                          <th className="text-right p-2 text-xs sm:text-sm">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.expenses.map((e, idx) => (
                          <tr key={idx} className="border-b last:border-0 align-top">
                            <td className="p-2 text-sm whitespace-nowrap">
                              {format(new Date(e.date), "MMM d, yyyy")}
                            </td>
                            <td className="p-2 text-sm">
                              <div className="font-medium">{e.title}</div>
                              {e.category && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {e.category}
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 text-sm">{e.paidBy}</td>
                            <td className="p-2 text-sm">
                              {e.splitBetween.join(", ")}
                            </td>
                            <td className="p-2 text-sm text-right whitespace-nowrap">
                              {formatINR(e.perPerson)}
                            </td>
                            <td className="p-2 text-sm text-right font-medium whitespace-nowrap">
                              {formatINR(e.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-person">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-lg sm:text-xl">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    By Person
                  </div>
                  {personNames.length > 0 && (
                    <Select
                      value={activePerson ?? undefined}
                      onValueChange={setSelectedPerson}
                    >
                      <SelectTrigger className="w-full sm:w-[220px] h-9">
                        <SelectValue placeholder="Choose person" />
                      </SelectTrigger>
                      <SelectContent>
                        {personNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!personData ? (
                  <p className="text-sm text-muted-foreground">No people in this report.</p>
                ) : (
                  <>
                    {personData.balance && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        <div className="rounded-md border border-border/50 p-3 bg-secondary/20">
                          <div className="text-xs text-muted-foreground">Paid</div>
                          <div className="text-sm sm:text-base font-semibold mt-1">
                            {formatINR(personData.balance.totalPaid)}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/50 p-3 bg-secondary/20">
                          <div className="text-xs text-muted-foreground">Owed (share)</div>
                          <div className="text-sm sm:text-base font-semibold mt-1">
                            {formatINR(personData.balance.totalOwed)}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/50 p-3 bg-secondary/20">
                          <div className="text-xs text-muted-foreground">Net</div>
                          <div
                            className={
                              "text-sm sm:text-base font-semibold mt-1 " +
                              (personData.balance.balance > 0.01
                                ? "text-green-600"
                                : personData.balance.balance < -0.01
                                ? "text-red-600"
                                : "")
                            }
                          >
                            {personData.balance.balance >= 0 ? "+" : "-"}
                            {formatINR(Math.abs(personData.balance.balance))}
                          </div>
                        </div>
                        <div className="rounded-md border border-border/50 p-3 bg-secondary/20">
                          <div className="text-xs text-muted-foreground">Status</div>
                          <div className="mt-1">
                            {statusBadge(personData.balance.status)}
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-sm font-semibold mb-2">
                        Expenses {activePerson} paid for ({personData.paidByThem.length})
                      </div>
                      {personData.paidByThem.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None.</p>
                      ) : (
                        <div className="space-y-2">
                          {personData.paidByThem.map((e, idx) => (
                            <div
                              key={`paid-${idx}`}
                              className="flex items-start justify-between gap-3 rounded-md border border-border/50 p-3 bg-secondary/20"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{e.title}</span>
                                  {e.category && (
                                    <Badge variant="secondary" className="text-xs">
                                      {e.category}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(e.date), "MMM d, yyyy")}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Split with {e.splitBetween.length}{" "}
                                  {e.splitBetween.length === 1 ? "person" : "people"}:{" "}
                                  {e.splitBetween.join(", ")}
                                </div>
                              </div>
                              <div className="text-sm font-semibold whitespace-nowrap">
                                {formatINR(e.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold mb-2">
                        {activePerson}'s share in others' expenses ({personData.owesShareIn.length})
                      </div>
                      {personData.owesShareIn.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None.</p>
                      ) : (
                        <div className="space-y-2">
                          {personData.owesShareIn.map((e, idx) => (
                            <div
                              key={`owes-${idx}`}
                              className="flex items-start justify-between gap-3 rounded-md border border-border/50 p-3 bg-secondary/20"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{e.title}</span>
                                  {e.category && (
                                    <Badge variant="secondary" className="text-xs">
                                      {e.category}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(e.date), "MMM d, yyyy")}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Paid by {e.paidBy} · split {e.splitBetween.length}-way
                                </div>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <div className="text-sm font-semibold">
                                  {formatINR(e.perPerson)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  of {formatINR(e.amount)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Shared via ExpenseWaale
        </p>
      </div>
    </div>
  );
}
