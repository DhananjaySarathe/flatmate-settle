import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Download,
  Loader2,
  Sparkles,
  Heart,
  Flame,
  Pizza,
  ShoppingBasket,
  Fuel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import autoTable from "jspdf-autotable";
import {
  drawPdfHeader,
  drawPdfFooter,
  drawSectionTitle,
  tableStyles,
  accentTableStyles,
  createPdfDoc,
  pdfAmount,
} from "@/lib/pdfStyle";
import { format } from "date-fns";
import { PageHeader, Panel, SkeletonRows } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { formatMoney } from "@/lib/format";

interface Flatmate {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  category_id?: string;
  categories?: {
    name: string;
  };
  expense_splits: { flatmate_id: string }[];
}

interface PersonStats {
  id: string;
  name: string;
  totalPaid: number;
  expenseCount: number;
  highestExpense: number;
  categoryTotals: Record<string, number>;
}

export default function Leaderboard() {
  const {
    selectedSplitSpace,
    splitSpaces,
    loading: contextLoading,
  } = useSplitSpace();
  const [loading, setLoading] = useState(true);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [personStats, setPersonStats] = useState<PersonStats[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (contextLoading) return;
    if (splitSpaces.length === 0 || !selectedSplitSpace) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [selectedSplitSpace, splitSpaces.length, contextLoading]);

  const fetchData = async () => {
    if (!selectedSplitSpace) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [flatmatesRes, expensesRes, categoriesRes] = await Promise.all([
        supabase
          .from("flatmates")
          .select("id, name")
          .or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`)
          .order("name"),
        supabase
          .from("expenses")
          .select(
            `
            *,
            categories (name),
            expense_splits (flatmate_id)
          `
          )
          .or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`)
          .order("date", { ascending: false }),
        user
          ? supabase
              .from("categories")
              .select("id, name")
              .eq("created_by", user.id)
              .order("name")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setFlatmates(flatmatesRes.data || []);
      setExpenses(expensesRes.data || []);
      setCategories(categoriesRes.data || []);

      // Calculate stats
      const stats: PersonStats[] = flatmatesRes.data?.map((flatmate) => {
        const paidExpenses = expensesRes.data?.filter(
          (exp) => exp.paid_by === flatmate.id
        ) || [];
        const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const highestExpense =
          paidExpenses.length > 0
            ? Math.max(...paidExpenses.map((exp) => exp.amount))
            : 0;

        // Category totals
        const categoryTotals: Record<string, number> = {};
        paidExpenses.forEach((exp) => {
          if (exp.category_id && exp.categories) {
            const catName = exp.categories.name;
            categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.amount;
          }
        });

        return {
          id: flatmate.id,
          name: flatmate.name,
          totalPaid,
          expenseCount: paidExpenses.length,
          highestExpense,
          categoryTotals,
        };
      }) || [];

      setPersonStats(stats.sort((a, b) => b.totalPaid - a.totalPaid));
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(`Failed to fetch data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const topPayers = personStats.slice(0, 3);
  const mostGenerous = personStats[0];
  const silentAssassin = personStats
    .filter((p) => p.expenseCount > 0)
    .sort((a, b) => a.totalPaid - b.totalPaid)[0];
  const bigSpender = [...personStats].sort((a, b) => b.highestExpense - a.highestExpense)[0];

  // Category-specific badges
  const getCategoryLeader = (categoryName: string) => {
    return personStats.reduce(
      (leader, person) => {
        const categoryTotal = person.categoryTotals[categoryName] || 0;
        return categoryTotal > leader.total ? { ...person, total: categoryTotal } : leader;
      },
      { name: "N/A", total: 0 } as PersonStats & { total: number }
    );
  };

  const milkBhai = getCategoryLeader("Groceries");
  const fuelKing = getCategoryLeader("Fuel");
  const foodie = getCategoryLeader("Food");

  const generateLeaderboardPDF = async () => {
    setPdfLoading(true);
    try {
      const doc = createPdfDoc();

      let y = drawPdfHeader(doc, {
        title: "Leaderboard",
        subtitle: selectedSplitSpace ? selectedSplitSpace.name : undefined,
        meta: format(new Date(), "MMM d, yyyy"),
      });

      y = drawSectionTitle(doc, "Top 3 Payers", y);

      const topPayersData = topPayers.map((person, idx) => [
        idx === 0 ? "Gold" : idx === 1 ? "Silver" : "Bronze",
        person.name,
        pdfAmount(person.totalPaid),
        person.expenseCount.toString(),
      ]);

      autoTable(doc, {
        ...accentTableStyles({
          startY: y + 2,
          head: [["Rank", "Name", "Total Paid", "Expenses"]],
          body: topPayersData,
          columnStyles: {
            0: { fontStyle: "bold" },
            2: { halign: "right", fontStyle: "bold" },
            3: { halign: "center" },
          },
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      const finalY = (doc as any).lastAutoTable?.finalY || y;

      const sectionY = drawSectionTitle(doc, "Fun Stats & Badges", finalY + 14);

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
          columnStyles: {
            2: { halign: "right", fontStyle: "bold" },
          },
          didDrawPage: () => drawPdfFooter(doc),
        }),
      });

      drawPdfFooter(doc);
      doc.save(`leaderboard_${selectedSplitSpace?.name || "default"}.pdf`);
      toast.success("Leaderboard PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  if (!selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div>
        <PageHeader title="Leaderboard" />
        <Panel>
          <p className="py-2 text-sm text-muted-foreground">Pick a space from the switcher to see the leaderboard.</p>
        </Panel>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Leaderboard" description="\u00a0" />
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        className="mb-1 lg:mb-2"
        title="Leaderboard"
        description={`Who's paid the most in ${selectedSplitSpace?.name ?? "this space"}, all time`}
        actions={
          <Button
            onClick={generateLeaderboardPDF}
            disabled={pdfLoading || personStats.length === 0}
            variant="outline"
            className="bg-card"
          >
            {pdfLoading ? <Loader2 className="animate-spin" /> : <Download />}
            Download PDF
          </Button>
        }
      />

      {personStats.every((p) => p.expenseCount === 0) && (
        <Panel>
          <p className="py-2 text-sm text-muted-foreground">
            No expenses yet. Rankings appear once people start paying for things.
          </p>
        </Panel>
      )}

      {/* Podium */}
      {topPayers.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:p-8">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
              {/* 2nd place */}
              {topPayers[1] ? (
                <PodiumStep place={2} person={topPayers[1]} />
              ) : (
                <PodiumPlaceholder place={2} />
              )}
              {/* 1st place — taller */}
              <PodiumStep place={1} person={topPayers[0]} />
              {/* 3rd place */}
              {topPayers[2] ? (
                <PodiumStep place={3} person={topPayers[2]} />
              ) : (
                <PodiumPlaceholder place={3} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fun Stats / Badges */}
      <div>
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Badges</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {mostGenerous && (
            <BadgeCard
              icon={Heart}
              emoji="💖"
              title="Most Generous"
              subtitle={`${formatMoney(mostGenerous.totalPaid, { whole: true })} paid in total`}
              name={mostGenerous.name}
              tone="rose"
            />
          )}
          {silentAssassin && (
            <BadgeCard
              icon={Award}
              emoji="🥷"
              title="Silent Assassin"
              subtitle={`Only ${formatMoney(silentAssassin.totalPaid, { whole: true })} — still in the game`}
              name={silentAssassin.name}
              tone="slate"
            />
          )}
          {bigSpender && bigSpender.highestExpense > 0 && (
            <BadgeCard
              icon={Flame}
              emoji="💥"
              title="Big Spender"
              subtitle={`${formatMoney(bigSpender.highestExpense, { whole: true })} on a single expense`}
              name={bigSpender.name}
              tone="amber"
            />
          )}
          {milkBhai.total > 0 && (
            <BadgeCard
              icon={ShoppingBasket}
              emoji="🥛"
              title="Milk Bhai"
              subtitle={`${formatMoney(milkBhai.total, { whole: true })} on groceries`}
              name={milkBhai.name}
              tone="accent"
            />
          )}
          {fuelKing.total > 0 && (
            <BadgeCard
              icon={Fuel}
              emoji="⛽"
              title="Fuel King"
              subtitle={`${formatMoney(fuelKing.total, { whole: true })} on fuel`}
              name={fuelKing.name}
              tone="orange"
            />
          )}
          {foodie.total > 0 && (
            <BadgeCard
              icon={Pizza}
              emoji="🍕"
              title="Foodie"
              subtitle={`${formatMoney(foodie.total, { whole: true })} on food`}
              name={foodie.name}
              tone="primary"
            />
          )}
        </div>
      </div>

      {/* Full rankings */}
      {personStats.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold tracking-tight">Full rankings</CardTitle>
            <p className="text-sm text-muted-foreground">
              Everyone, sorted by total paid
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {personStats.map((person, idx) => (
                <div
                  key={person.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    idx === 0
                      ? "bg-amber-50 border-amber-200"
                      : "bg-secondary/40 border-border"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <RankBadge rank={idx + 1} />
                    <PersonAvatar name={person.name} seed={person.id} size="md" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{person.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {person.expenseCount} expense{person.expenseCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-base sm:text-lg tabular-nums">
                      {formatMoney(person.totalPaid, { whole: true })}
                    </div>
                    {person.highestExpense > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Max {formatMoney(person.highestExpense, { whole: true })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Sub-components ----

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? "");
}

function avatarColor(name: string): string {
  const palette = [
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-800",
    "bg-emerald-100 text-emerald-800",
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-orange-100 text-orange-800",
    "bg-teal-100 text-teal-700",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % palette.length;
  return palette[h];
}

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "w-14 h-14 text-base" : "w-9 h-9 text-xs";
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold flex-shrink-0",
        dim,
        avatarColor(name)
      )}
    >
      {initials(name)}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-8 h-8 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center text-sm font-bold flex-shrink-0">
        1
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-800 flex items-center justify-center text-sm font-bold flex-shrink-0">
        2
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-8 h-8 rounded-full bg-orange-300 text-orange-900 flex items-center justify-center text-sm font-bold flex-shrink-0">
        3
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">
      #{rank}
    </div>
  );
}

function PodiumStep({ place, person }: { place: 1 | 2 | 3; person: PersonStats }) {
  const config = {
    1: {
      height: "h-32 sm:h-40",
      bg: "bg-gradient-to-b from-amber-300 to-amber-200",
      border: "border-amber-400",
      icon: <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700" />,
      label: "1st",
      labelClass: "bg-amber-500 text-amber-50",
    },
    2: {
      height: "h-24 sm:h-32",
      bg: "bg-gradient-to-b from-slate-200 to-slate-100",
      border: "border-slate-300",
      icon: <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />,
      label: "2nd",
      labelClass: "bg-slate-400 text-white",
    },
    3: {
      height: "h-20 sm:h-24",
      bg: "bg-gradient-to-b from-orange-200 to-orange-100",
      border: "border-orange-300",
      icon: <Award className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />,
      label: "3rd",
      labelClass: "bg-orange-400 text-orange-50",
    },
  }[place];

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center mb-2 text-center">
        {config.icon}
        <PersonAvatar name={person.name} seed={person.id} size="md" className="h-14 w-14 text-base" />
        <div className="font-bold text-sm sm:text-base mt-2 truncate max-w-full">
          {person.name}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground tabular-nums">
          {formatMoney(person.totalPaid, { whole: true })}
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground">
          {person.expenseCount} expense{person.expenseCount !== 1 ? "s" : ""}
        </div>
      </div>
      <div
        className={cn(
          "w-full rounded-t-lg border border-b-0 flex items-center justify-center",
          config.height,
          config.bg,
          config.border
        )}
      >
        <span
          className={cn(
            "text-xs font-bold px-2.5 py-0.5 rounded-full",
            config.labelClass
          )}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
}

function PodiumPlaceholder({ place }: { place: 2 | 3 }) {
  const height = place === 2 ? "h-24 sm:h-32" : "h-20 sm:h-24";
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center mb-2 text-center opacity-40">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/30" />
        <div className="text-xs text-muted-foreground mt-2">No one yet</div>
      </div>
      <div
        className={cn(
          "w-full rounded-t-lg border border-b-0 border-dashed border-muted-foreground/20 bg-secondary/30",
          height
        )}
      />
    </div>
  );
}

const BADGE_TONES: Record<
  string,
  { ring: string; bg: string; iconBg: string; iconText: string }
> = {
  primary: {
    ring: "hover:border-primary/40",
    bg: "from-primary/8 to-transparent",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
  },
  accent: {
    ring: "hover:border-accent/40",
    bg: "from-accent/8 to-transparent",
    iconBg: "bg-accent/10",
    iconText: "text-accent",
  },
  amber: {
    ring: "hover:border-amber-400",
    bg: "from-amber-200/30 to-transparent",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
  },
  rose: {
    ring: "hover:border-rose-300",
    bg: "from-rose-200/30 to-transparent",
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
  },
  slate: {
    ring: "hover:border-slate-300",
    bg: "from-slate-200/40 to-transparent",
    iconBg: "bg-slate-100",
    iconText: "text-slate-700",
  },
  orange: {
    ring: "hover:border-orange-300",
    bg: "from-orange-200/30 to-transparent",
    iconBg: "bg-orange-100",
    iconText: "text-orange-700",
  },
};

function BadgeCard({
  icon: Icon,
  emoji,
  title,
  subtitle,
  name,
  tone,
}: {
  icon: typeof Trophy;
  emoji: string;
  title: string;
  subtitle: string;
  name: string;
  tone: keyof typeof BADGE_TONES;
}) {
  const t = BADGE_TONES[tone];
  return (
    <Card className="overflow-hidden shadow-card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
              t.iconBg,
              t.iconText
            )}
            aria-hidden
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-base sm:text-lg font-bold truncate">{name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

