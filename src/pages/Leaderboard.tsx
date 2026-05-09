import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Crown, Download, Loader2 } from "lucide-react";
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
} from "@/lib/pdfStyle";
import { format } from "date-fns";

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
  const bigSpender = personStats.sort((a, b) => b.highestExpense - a.highestExpense)[0];

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
        `₹${person.totalPaid.toFixed(2)}`,
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
        ["Most Generous", mostGenerous?.name || "N/A", `₹${mostGenerous?.totalPaid.toFixed(2) || "0.00"}`],
        ["Silent Assassin", silentAssassin?.name || "N/A", `₹${silentAssassin?.totalPaid.toFixed(2) || "0.00"}`],
        ["Big Spender", bigSpender?.name || "N/A", `₹${bigSpender?.highestExpense.toFixed(2) || "0.00"}`],
        ["Milk Bhai (Groceries)", milkBhai.name, `₹${milkBhai.total.toFixed(2)}`],
        ["Fuel King", fuelKing.name, `₹${fuelKing.total.toFixed(2)}`],
        ["Foodie", foodie.name, `₹${foodie.total.toFixed(2)}`],
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">
            Please select a SplitSpace to continue.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            Leaderboard
          </h1>
          {selectedSplitSpace && (
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              SplitSpace: {selectedSplitSpace.name}
            </p>
          )}
        </div>
        <Button onClick={generateLeaderboardPDF} disabled={pdfLoading}>
          {pdfLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </>
          )}
        </Button>
      </div>

      {/* Top 3 Payers */}
      {topPayers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {topPayers.map((person, idx) => (
            <Card
              key={person.id}
              className={`${
                idx === 0
                  ? "border-yellow-500 border-2 bg-yellow-50 dark:bg-yellow-950"
                  : idx === 1
                  ? "border-gray-400 border-2 bg-gray-50 dark:bg-gray-900"
                  : "border-orange-600 border-2 bg-orange-50 dark:bg-orange-950"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                  {idx === 0 ? (
                    <Crown className="w-6 h-6 text-yellow-500" />
                  ) : idx === 1 ? (
                    <Medal className="w-6 h-6 text-gray-400" />
                  ) : (
                    <Award className="w-6 h-6 text-orange-600" />
                  )}
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"} Place
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold mb-2">{person.name}</div>
                <div className="text-lg text-muted-foreground">
                  ${person.totalPaid.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {person.expenseCount} expense{person.expenseCount !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fun Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mostGenerous && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Most Generous
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{mostGenerous.name}</div>
              <div className="text-muted-foreground">
                ${mostGenerous.totalPaid.toFixed(2)} total
              </div>
            </CardContent>
          </Card>
        )}

        {silentAssassin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-500" />
                Silent Assassin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{silentAssassin.name}</div>
              <div className="text-muted-foreground">
                ${silentAssassin.totalPaid.toFixed(2)} (least paid, still active)
              </div>
            </CardContent>
          </Card>
        )}

        {bigSpender && bigSpender.highestExpense > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-red-500" />
                Big Spender
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{bigSpender.name}</div>
              <div className="text-muted-foreground">
                ${bigSpender.highestExpense.toFixed(2)} (highest single expense)
              </div>
            </CardContent>
          </Card>
        )}

        {milkBhai.total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-green-500" />
                Milk Bhai
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{milkBhai.name}</div>
              <div className="text-muted-foreground">
                ${milkBhai.total.toFixed(2)} on Groceries
              </div>
            </CardContent>
          </Card>
        )}

        {fuelKing.total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-orange-500" />
                Fuel King
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{fuelKing.name}</div>
              <div className="text-muted-foreground">
                ${fuelKing.total.toFixed(2)} on Fuel
              </div>
            </CardContent>
          </Card>
        )}

        {foodie.total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-pink-500" />
                Foodie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{foodie.name}</div>
              <div className="text-muted-foreground">
                ${foodie.total.toFixed(2)} on Food
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full Leaderboard */}
      {personStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Full Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {personStats.map((person, idx) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg w-8">
                      {idx + 1 <= 3 ? (idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉") : `#${idx + 1}`}
                    </span>
                    <div>
                      <div className="font-semibold">{person.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {person.expenseCount} expense{person.expenseCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">${person.totalPaid.toFixed(2)}</div>
                    {person.highestExpense > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Max: ${person.highestExpense.toFixed(2)}
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

