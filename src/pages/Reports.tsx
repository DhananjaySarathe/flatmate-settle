import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowUpDown,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  History,
  Link2,
  Loader2,
  Receipt,
  RotateCw,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseRow } from "@/components/ExpenseRow";
import { BalanceList, PaymentList } from "@/components/LedgerViews";
import { ReportControls } from "@/components/ReportControls";
import { buildPeriodPresets } from "@/lib/periods";
import { MarkSettledDialog, ShareLinkResult } from "@/components/SettleActions";
import { useShareLink } from "@/hooks/useShareLink";
import { useExpenseSheet } from "@/contexts/ExpenseSheetContext";
import { useReportFilters } from "@/hooks/useReportFilters";
import { useRefreshSpaceData, useSpaceData, type Expense, type SavedSettlement } from "@/hooks/useSpaceData";
import { useMe } from "@/hooks/useMe";
import { applyExpenseFilters, countActiveFilters, inRange } from "@/lib/expenseFilters";
import { buildLedger } from "@/lib/ledger";
import { deleteSettlement } from "@/lib/mutations";
import { copyText, expenseBreakdownText, settlementSummaryText } from "@/lib/shareText";
import { errorMessage } from "@/lib/db";
import { formatMoney, formatRange, parseDateOnly, plural, toDateOnly } from "@/lib/format";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "title-asc" | "title-desc";

const SORTS: Record<SortKey, { label: string; compare: (a: Expense, b: Expense) => number }> = {
  "date-desc": { label: "Newest first", compare: (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) },
  "date-asc": { label: "Oldest first", compare: (a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0) },
  "amount-desc": { label: "Highest amount", compare: (a, b) => b.amount - a.amount },
  "amount-asc": { label: "Lowest amount", compare: (a, b) => a.amount - b.amount },
  "title-asc": { label: "Title A–Z", compare: (a, b) => a.title.localeCompare(b.title) },
  "title-desc": { label: "Title Z–A", compare: (a, b) => b.title.localeCompare(a.title) },
};

const PREVIEW_COUNT = 12;

export default function Reports() {
  const { flatmates, expenses: allExpenses, categories, settlements: saved, space, spaceId, isLoading, error, refetch } =
    useSpaceData();
  const { meId } = useMe(flatmates);
  const { openEditExpense } = useExpenseSheet();
  const refresh = useRefreshSpaceData();
  const { dateRange, peopleFilters, categoryFilters, setDateRange, setPeopleFilters, setCategoryFilters } =
    useReportFilters();
  const [sortBy, setSortBy] = useState<SortKey>("date-desc");
  const [showAll, setShowAll] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SavedSettlement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const share = useShareLink();
  const [searchParams, setSearchParams] = useSearchParams();

  const presets = useMemo(() => buildPeriodPresets(allExpenses, saved), [allExpenses, saved]);

  // Home links here with ?period=open to show the period that's still open.
  const wantsOpen = searchParams.get("period") === "open";
  useEffect(() => {
    if (!wantsOpen || isLoading) return;
    const open = presets.quick.find((p) => p.id === "open") ?? presets.quick.find((p) => p.id === "all");
    if (open) setDateRange(open.range);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsOpen, isLoading]);

  const from = toDateOnly(dateRange.from);
  const to = toDateOnly(dateRange.to);
  const inPeriod = useMemo(() => inRange(allExpenses, from, to), [allExpenses, from, to]);
  const expenses = useMemo(
    () => applyExpenseFilters(inPeriod, peopleFilters, categoryFilters).sort(SORTS[sortBy].compare),
    [inPeriod, peopleFilters, categoryFilters, sortBy]
  );
  const ledger = useMemo(() => buildLedger(flatmates, expenses), [flatmates, expenses]);
  const filterCount = countActiveFilters(peopleFilters, categoryFilters);
  // Settled periods this range touches; settling again would re-bill those expenses.
  const overlapping = saved.filter((s) => s.from_date <= to && s.to_date >= from);
  const isSettledPeriod = overlapping.length === 1 && overlapping[0].from_date === from && overlapping[0].to_date === to;
  const openPreset = presets.quick.find((p) => p.id === "open");

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)?.name ?? "Unknown";
  const labelOf = (id: string) => (id === meId ? "You" : nameOf(id));
  const period = { from: dateRange.from, to: dateRange.to };
  const paymentsTotal = ledger.payments.reduce((sum, p) => sum + p.amount, 0);

  const copy = async (text: string, what: string) => {
    const ok = await copyText(text);
    if (ok) toast.success(`${what} copied`);
    else toast.error("Couldn't copy to the clipboard.");
  };

  const download = async (kind: "summary" | "expenses") => {
    try {
      // jsPDF is large; fetch it only when someone exports.
      const { downloadExpensesPdf, downloadSettlementPdf } = await import("@/lib/reportPdf");
      if (kind === "summary") {
        downloadSettlementPdf({
          expenses,
          flatmates,
          period,
          spaceName: space?.name,
          balances: ledger.balances,
          settlements: ledger.settlements,
        });
      } else {
        downloadExpensesPdf({ expenses, flatmates, period, spaceName: space?.name });
      }
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Couldn't create the PDF");
    }
  };

  const removeSettlement = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSettlement(toDelete.id);
      await refresh(["settlements"]);
      toast.success("Settled period removed");
      setToDelete(null);
    } catch (err) {
      toast.error(`Couldn't remove it: ${errorMessage(err)}`);
    } finally {
      setDeleting(false);
    }
  };

  const header = (
    <PageHeader
      title="Balances"
      description={
        <>
          {space ? `${space.name} · ` : ""}
          {formatRange(dateRange.from, dateRange.to)}
        </>
      }
      actions={
        !isLoading &&
        flatmates.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Download PDF</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => download("summary")} disabled={expenses.length === 0}>
                <FileText className="size-4" />
                Settlement report
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download("expenses")} disabled={expenses.length === 0}>
                <Receipt className="size-4" />
                Expense list
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Copy as text</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => copy(settlementSummaryText(ledger.settlements, period, space?.name), "Settle-up summary")}
                disabled={ledger.settlements.length === 0}
              >
                <ClipboardCopy className="size-4" />
                Settle-up summary
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => copy(expenseBreakdownText(expenses, flatmates, period, space?.name), "Expense breakdown")}
                disabled={expenses.length === 0}
              >
                <ClipboardCopy className="size-4" />
                Expenses by who paid
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        {header}
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState
          icon={RotateCw}
          title="Couldn't load balances"
          action={<Button onClick={refetch}>Try again</Button>}
          className="rounded-2xl border bg-card"
        >
          {errorMessage(error)}
        </EmptyState>
      </div>
    );
  }

  if (flatmates.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState
          icon={Users}
          title="No people in this space yet"
          action={
            <Button asChild>
              <Link to="/people">Add people</Link>
            </Button>
          }
          className="rounded-2xl border bg-card"
        >
          Balances appear once people share expenses.
        </EmptyState>
      </div>
    );
  }

  const visible = showAll ? expenses : expenses.slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-5">
      {header}

      <ReportControls
        range={dateRange}
        onRangeChange={setDateRange}
        presets={presets}
        people={peopleFilters}
        onPeopleChange={setPeopleFilters}
        categoryFilters={categoryFilters}
        onCategoryChange={setCategoryFilters}
        flatmates={flatmates}
        categories={categories}
        labelOf={labelOf}
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filterCount > 0 ? "No expenses match these filters" : "No expenses in this period"}
          className="rounded-2xl border bg-card"
          action={
            inPeriod.length === 0 &&
            allExpenses.length > 0 && (
              <>
                {presets.quick
                  .filter((p) => p.id === "open" || p.id === "all")
                  .map((p) => (
                    <Button key={p.id} variant="outline" onClick={() => setDateRange(p.range)}>
                      {p.id === "all" ? "Show all time" : p.label}
                    </Button>
                  ))}
              </>
            )
          }
        >
          {filterCount > 0
            ? "Remove a filter or pick a different period."
            : allExpenses.length > 0
              ? `This space has ${plural(allExpenses.length, "expense")}, just none dated in this range.`
              : "Add an expense and it will show up here."}
        </EmptyState>
      ) : (
        <>
          <p className="text-[15px] text-pretty">
            <span className="font-semibold">{formatMoney(ledger.total)}</span> spent across{" "}
            {plural(expenses.length, "expense")}
            {ledger.payments.length > 0 ? (
              <>
                {" · "}
                <span className="font-semibold">{formatMoney(paymentsTotal)}</span> to settle in{" "}
                {plural(ledger.payments.length, "payment")}
              </>
            ) : (
              " · everyone's square"
            )}
          </p>

          {overlapping.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3 text-sm">
              <p className="min-w-0 flex-1 text-pretty">
                {isSettledPeriod
                  ? `You marked this period as settled${
                      overlapping[0].note ? ` (${overlapping[0].note})` : ""
                    }, so these payments should already have happened.`
                  : `Part of this range was already settled (${overlapping
                      .map((o) => formatRange(parseDateOnly(o.from_date), parseDateOnly(o.to_date)))
                      .join(", ")}). The payments below count those expenses again.`}
              </p>
              {!isSettledPeriod && openPreset && (
                <Button size="sm" variant="outline" onClick={() => setDateRange(openPreset.range)}>
                  Since last settle-up
                </Button>
              )}
            </div>
          )}

          {filterCount > 0 && (
            <p className="rounded-xl bg-secondary px-4 py-3 text-sm">
              These balances only count expenses that match your {plural(filterCount, "filter")}. Clear them to see
              what everyone really owes.
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <section className="rounded-2xl border bg-card px-5 pb-5 pt-4 sm:px-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">Settle up</h2>
                <span className="text-sm text-muted-foreground">
                  {ledger.payments.length === 0 ? "Nothing to pay" : plural(ledger.payments.length, "payment")}
                </span>
              </div>
              {ledger.payments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Everyone's square for this period.</p>
              ) : (
                <PaymentList payments={ledger.payments} nameOf={nameOf} meId={meId} className="mt-1" />
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {space && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={share.creating}
                    onClick={() =>
                      share.create({
                        space,
                        range: period,
                        balances: ledger.balances,
                        settlements: ledger.settlements,
                        expenses,
                        flatmates,
                      })
                    }
                  >
                    {share.creating ? <Loader2 className="animate-spin" /> : <Link2 />}
                    Share link
                  </Button>
                )}
                {spaceId && (
                  <Button variant="outline" size="sm" onClick={() => setSettleOpen(true)}>
                    <CheckCircle2 />
                    Mark period as settled
                  </Button>
                )}
              </div>
              {share.url && (
                <div className="mt-3">
                  <ShareLinkResult url={share.url} onDismiss={share.reset} />
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">Balances</h2>
                <span className="text-sm text-muted-foreground">Paid minus share</span>
              </div>
              <BalanceList balances={ledger.balances} meId={meId} className="mt-1" />
            </section>
          </div>

          <section className="rounded-2xl border bg-card px-5 pb-3 pt-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                Expenses <span className="font-normal text-muted-foreground">({expenses.length})</span>
              </h2>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="h-9 w-44 text-sm" aria-label="Sort expenses">
                  <ArrowUpDown className="size-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORTS) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SORTS[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-1 divide-y">
              {visible.map((e) => (
                <ExpenseRow key={e.id} expense={e} labelOf={labelOf} onSelect={openEditExpense} />
              ))}
            </div>
            {expenses.length > PREVIEW_COUNT && (
              <Button variant="ghost" className="mt-1 w-full text-muted-foreground" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show fewer" : `Show all ${expenses.length}`}
              </Button>
            )}
          </section>
        </>
      )}

      {spaceId && (
        <section className="rounded-2xl border bg-card px-5 pb-3 pt-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <History className="size-4 text-muted-foreground" />
              Settled periods
            </h2>
            <span className="text-sm text-muted-foreground">{saved.length || "None yet"}</span>
          </div>
          {saved.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              When everyone has paid up, mark the period as settled. The next settle-up starts the day after.
            </p>
          ) : (
            <ul className="mt-1 divide-y">
              {[...saved]
                .sort((a, b) => (a.to_date < b.to_date ? 1 : -1))
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => setDateRange({ from: parseDateOnly(s.from_date), to: parseDateOnly(s.to_date) })}
                      className="min-w-0 flex-1 rounded-md text-left hover:text-primary"
                      title="Show this period"
                    >
                      <span className="block text-sm font-medium">
                        {formatRange(parseDateOnly(s.from_date), parseDateOnly(s.to_date))}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.note ? `${s.note} · ` : ""}Marked {format(new Date(s.created_at), "MMM d, yyyy")}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:bg-negative/10 hover:text-negative"
                      onClick={() => setToDelete(s)}
                      aria-label="Remove settled period"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {spaceId && (
        <MarkSettledDialog
          open={settleOpen}
          onOpenChange={setSettleOpen}
          spaceId={spaceId}
          range={period}
          filtersActive={filterCount > 0}
          overlapping={overlapping}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this settled period?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && formatRange(parseDateOnly(toDelete.from_date), parseDateOnly(toDelete.to_date))} will count as
              unsettled again. No expenses are deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                removeSettlement();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
