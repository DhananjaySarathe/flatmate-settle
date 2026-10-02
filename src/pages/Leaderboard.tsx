import { useMemo } from "react";
import { format } from "date-fns";
import autoTable from "jspdf-autotable";
import type jsPDF from "jspdf";
import { toast } from "sonner";
import {
  Award,
  Crown,
  Download,
  EyeOff,
  Flame,
  Fuel,
  Heart,
  type LucideIcon,
  Medal,
  Milk,
  Pizza,
  RotateCw,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { InsightsTabs } from "@/components/InsightsTabs";
import { EmptyState } from "@/components/EmptyState";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useSpaceData } from "@/hooks/useSpaceData";
import { useMe } from "@/hooks/useMe";
import { errorMessage } from "@/lib/db";
import { formatMoney, plural } from "@/lib/format";
import {
  drawPdfHeader,
  drawPdfFooter,
  drawSectionTitle,
  tableStyles,
  accentTableStyles,
  createPdfDoc,
  pdfAmount,
} from "@/lib/pdfStyle";
import { cn } from "@/lib/utils";

interface PersonStats {
  id: string;
  name: string;
  totalPaid: number;
  expenseCount: number;
  highestExpense: number;
  categoryTotals: Record<string, number>;
}

const lastTableY = (doc: jsPDF, fallback: number) =>
  (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || fallback;

export default function Leaderboard() {
  const { flatmates, expenses, space, isLoading, error, refetch } = useSpaceData();
  const { meId } = useMe(flatmates);

  const personStats = useMemo<PersonStats[]>(() => {
    const stats = flatmates.map((flatmate) => {
      const paidExpenses = expenses.filter((exp) => exp.paid_by === flatmate.id);
      const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const highestExpense = paidExpenses.length > 0 ? Math.max(...paidExpenses.map((exp) => exp.amount)) : 0;
      const categoryTotals: Record<string, number> = {};
      paidExpenses.forEach((exp) => {
        if (exp.category_id && exp.categories) {
          const catName = exp.categories.name;
          categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.amount;
        }
      });
      return { id: flatmate.id, name: flatmate.name, totalPaid, expenseCount: paidExpenses.length, highestExpense, categoryTotals };
    });
    return stats.sort((a, b) => b.totalPaid - a.totalPaid);
  }, [flatmates, expenses]);

  const topPayers = personStats.slice(0, 3);
  const mostGenerous = personStats[0];
  const silentAssassin = personStats.filter((p) => p.expenseCount > 0).sort((a, b) => a.totalPaid - b.totalPaid)[0];
  // Sort a copy: sorting personStats itself used to reorder the rankings below by biggest single expense.
  const bigSpender = [...personStats].sort((a, b) => b.highestExpense - a.highestExpense)[0];

  const getCategoryLeader = (categoryName: string) =>
    personStats.reduce<PersonStats & { total: number }>(
      (leader, person) => {
        const categoryTotal = person.categoryTotals[categoryName] || 0;
        return categoryTotal > leader.total ? { ...person, total: categoryTotal } : leader;
      },
      { id: "", name: "N/A", totalPaid: 0, expenseCount: 0, highestExpense: 0, categoryTotals: {}, total: 0 }
    );

  const milkBhai = getCategoryLeader("Groceries");
  const fuelKing = getCategoryLeader("Fuel");
  const foodie = getCategoryLeader("Food");

  const generateLeaderboardPDF = () => {
    try {
      const doc = createPdfDoc();
      const y = drawPdfHeader(doc, {
        title: "Leaderboard",
        subtitle: space ? space.name : undefined,
        meta: format(new Date(), "MMM d, yyyy"),
      });

      const titleY = drawSectionTitle(doc, "Top 3 Payers", y);
      autoTable(doc, {
        ...accentTableStyles({
          startY: titleY + 2,
          head: [["Rank", "Name", "Total Paid", "Expenses"]],
          body: topPayers.map((person, idx) => [
            idx === 0 ? "Gold" : idx === 1 ? "Silver" : "Bronze",
            person.name,
            pdfAmount(person.totalPaid),
            person.expenseCount.toString(),
          ]),
          columnStyles: {
            0: { fontStyle: "bold" },
            2: { halign: "right", fontStyle: "bold" },
            3: { halign: "center" },
          },
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      const sectionY = drawSectionTitle(doc, "Fun Stats & Badges", lastTableY(doc, titleY) + 14);
      const funStatsData = [
        ["Most Generous", mostGenerous?.name || "N/A", mostGenerous ? pdfAmount(mostGenerous.totalPaid) : "Rs. 0.00"],
        ["Silent Assassin", silentAssassin?.name || "N/A", silentAssassin ? pdfAmount(silentAssassin.totalPaid) : "Rs. 0.00"],
        ["Big Spender", bigSpender?.name || "N/A", bigSpender ? pdfAmount(bigSpender.highestExpense) : "Rs. 0.00"],
        ["Milk Bhai (Groceries)", milkBhai.name, pdfAmount(milkBhai.total)],
        ["Fuel King", fuelKing.name, pdfAmount(fuelKing.total)],
        ["Foodie", foodie.name, pdfAmount(foodie.total)],
      ];
      autoTable(doc, {
        ...tableStyles({
          startY: sectionY + 2,
          head: [["Badge", "Winner", "Amount"]],
          body: funStatsData,
          columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      drawPdfFooter(doc);
      doc.save(`leaderboard_${space?.name || "default"}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Couldn't create the PDF");
    }
  };

  const nameFor = (p: { id: string; name: string }) => (p.id === meId ? "You" : p.name);
  const money0 = (n: number) => formatMoney(n, { decimals: 0 });

  const badges: { show: boolean; icon: LucideIcon; title: string; winner?: { id: string; name: string }; detail: string }[] = [
    {
      show: !!mostGenerous && mostGenerous.totalPaid > 0,
      icon: Heart,
      title: "Most generous",
      winner: mostGenerous,
      detail: mostGenerous ? `${money0(mostGenerous.totalPaid)} paid in total` : "",
    },
    {
      show: !!silentAssassin,
      icon: EyeOff,
      title: "Silent assassin",
      winner: silentAssassin,
      detail: silentAssassin ? `Only ${money0(silentAssassin.totalPaid)}, still in the game` : "",
    },
    {
      show: !!bigSpender && bigSpender.highestExpense > 0,
      icon: Flame,
      title: "Big spender",
      winner: bigSpender,
      detail: bigSpender ? `${money0(bigSpender.highestExpense)} on a single expense` : "",
    },
    { show: milkBhai.total > 0, icon: Milk, title: "Milk Bhai", winner: milkBhai, detail: `${money0(milkBhai.total)} on groceries` },
    { show: fuelKing.total > 0, icon: Fuel, title: "Fuel King", winner: fuelKing, detail: `${money0(fuelKing.total)} on fuel` },
    { show: foodie.total > 0, icon: Pizza, title: "Foodie", winner: foodie, detail: `${money0(foodie.total)} on food` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Insights"
        documentTitle="Leaderboard"
        description={`All-time bragging rights${space ? ` in ${space.name}` : ""}. Ranked by who paid the most.`}
        actions={
          !isLoading &&
          personStats.length > 0 && (
            <Button variant="outline" onClick={generateLeaderboardPDF}>
              <Download />
              Download PDF
            </Button>
          )
        }
      />
      <InsightsTabs />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : error ? (
        <EmptyState
          icon={RotateCw}
          title="Couldn't load the leaderboard"
          action={<Button onClick={refetch}>Try again</Button>}
          className="rounded-2xl border bg-card"
        >
          {errorMessage(error)}
        </EmptyState>
      ) : personStats.length === 0 || expenses.length === 0 ? (
        <EmptyState icon={Trophy} title="No rankings yet" className="rounded-2xl border bg-card">
          The leaderboard fills in once people start paying for things.
        </EmptyState>
      ) : (
        <>
          <section className="rounded-2xl border bg-card px-4 pb-0 pt-6 sm:px-8" aria-label="Top payers">
            <div className="mx-auto grid max-w-xl grid-cols-3 items-end gap-2 sm:gap-4">
              {[1, 0, 2].map((idx) => {
                const person = topPayers[idx];
                return person ? (
                  <PodiumStep key={idx} place={(idx + 1) as 1 | 2 | 3} name={person.name} label={nameFor(person)} person={person} />
                ) : (
                  <div key={idx} />
                );
              })}
            </div>
          </section>

          <section aria-label="Badges">
            <h2 className="mb-3 font-semibold">Badges</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges
                .filter((b) => b.show && b.winner)
                .map((b) => {
                  const Icon = b.icon;
                  return (
                    <div key={b.title} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{b.title}</p>
                        <p className="truncate font-semibold">{nameFor(b.winner!)}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.detail}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          <section className="rounded-2xl border bg-card px-5 pb-2 pt-4 sm:px-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">Full rankings</h2>
              <span className="text-sm text-muted-foreground">By total paid</span>
            </div>
            <ol className="mt-1 divide-y">
              {personStats.map((person, idx) => (
                <li key={person.id} className="flex items-center gap-3 py-3">
                  <span className="w-6 text-center text-sm font-semibold text-muted-foreground tabular-nums">{idx + 1}</span>
                  <PersonAvatar name={person.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", person.id === meId ? "font-semibold" : "font-medium")}>
                      {nameFor(person)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {plural(person.expenseCount, "expense")} paid
                      {person.highestExpense > 0 && ` · biggest ${money0(person.highestExpense)}`}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{money0(person.totalPaid)}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

const PODIUM = {
  1: { height: "h-28 sm:h-36", fill: "bg-primary/15", icon: Crown, tint: "text-amber-600", label: "1st" },
  2: { height: "h-20 sm:h-28", fill: "bg-secondary", icon: Medal, tint: "text-slate-500", label: "2nd" },
  3: { height: "h-14 sm:h-20", fill: "bg-secondary/70", icon: Award, tint: "text-orange-700", label: "3rd" },
} as const;

const PodiumStep = ({
  place,
  name,
  label,
  person,
}: {
  place: 1 | 2 | 3;
  name: string;
  label: string;
  person: PersonStats;
}) => {
  const c = PODIUM[place];
  const Icon = c.icon;
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <Icon className={cn("mb-1 size-5", c.tint)} strokeWidth={1.75} aria-hidden />
      <PersonAvatar name={name} size={place === 1 ? "xl" : "lg"} />
      <p className="mt-2 w-full truncate text-sm font-semibold">{label}</p>
      <p className="text-sm tabular-nums text-muted-foreground">{formatMoney(person.totalPaid, { decimals: 0 })}</p>
      <div className={cn("mt-3 flex w-full items-start justify-center rounded-t-xl pt-2", c.height, c.fill)}>
        <span className="text-xs font-semibold text-foreground/70">{c.label}</span>
      </div>
    </div>
  );
};
