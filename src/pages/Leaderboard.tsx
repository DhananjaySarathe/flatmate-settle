import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel, Section } from "@/components/common/PageHeader";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import {
  InsightsError,
  InsightsHeader,
  InsightsNoExpenses,
  InsightsNoGroup,
  InsightsNoPeople,
  InsightsPage,
  InsightsSkeleton,
} from "@/components/insights/InsightsChrome";
import { computeLeaderboard, type PersonStats } from "@/components/insights/insightMath";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useSpaceData } from "@/hooks/useSpaceData";
import { formatMoneyCompact, pluralize } from "@/lib/format";
import { generateLeaderboardPDF } from "@/lib/insightExports";
import { cn } from "@/lib/utils";

interface BadgeTile {
  key: string;
  emoji: string;
  title: string;
  winner: string;
  detail: string;
}

export default function Leaderboard() {
  const { selectedSplitSpace, splitSpaces, loading: spacesLoading } = useSplitSpace();
  const { people, expenses, isLoading, error, refetch } = useSpaceData(selectedSplitSpace?.id);
  const [pdfBusy, setPdfBusy] = useState(false);

  const data = useMemo(() => computeLeaderboard(people, expenses), [people, expenses]);
  const loaded = !spacesLoading && !isLoading && !error && !!selectedSplitSpace;

  const badges = useMemo<BadgeTile[]>(() => {
    const { mostGenerous, silentAssassin, bigSpender, milkBhai, fuelKing, foodie } = data;
    const tiles: BadgeTile[] = [];
    if (mostGenerous) {
      tiles.push({
        key: "generous",
        emoji: "💖",
        title: "Most generous",
        winner: mostGenerous.name,
        detail: `${formatMoneyCompact(mostGenerous.totalPaid)} paid in total`,
      });
    }
    if (silentAssassin) {
      tiles.push({
        key: "assassin",
        emoji: "🥷",
        title: "Silent assassin",
        winner: silentAssassin.name,
        detail: `Only ${formatMoneyCompact(silentAssassin.totalPaid)} paid, still in the game`,
      });
    }
    if (bigSpender && bigSpender.highestExpense > 0) {
      tiles.push({
        key: "big",
        emoji: "💥",
        title: "Big spender",
        winner: bigSpender.name,
        detail: `${formatMoneyCompact(bigSpender.highestExpense)} on a single expense`,
      });
    }
    if (milkBhai.total > 0) {
      tiles.push({
        key: "milk",
        emoji: "🥛",
        title: "Milk bhai",
        winner: milkBhai.name,
        detail: `${formatMoneyCompact(milkBhai.total)} on groceries`,
      });
    }
    if (fuelKing.total > 0) {
      tiles.push({
        key: "fuel",
        emoji: "⛽",
        title: "Fuel king",
        winner: fuelKing.name,
        detail: `${formatMoneyCompact(fuelKing.total)} on fuel`,
      });
    }
    if (foodie.total > 0) {
      tiles.push({
        key: "foodie",
        emoji: "🍕",
        title: "Foodie",
        winner: foodie.name,
        detail: `${formatMoneyCompact(foodie.total)} on food`,
      });
    }
    return tiles;
  }, [data]);

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const fileName = generateLeaderboardPDF({ spaceName: selectedSplitSpace?.name, data });
      toast.success("Downloaded the leaderboard", { description: fileName });
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Couldn't create the PDF", { description: "Try again. If it keeps failing, reload the page." });
    } finally {
      setPdfBusy(false);
    }
  };

  const header = (
    <InsightsHeader
      onDownload={downloadPdf}
      downloading={pdfBusy}
      canDownload={loaded && people.length > 0}
      caption="All time · by total paid"
    />
  );

  if (spacesLoading || (isLoading && !error)) {
    return (
      <InsightsPage>
        {header}
        <InsightsSkeleton variant="leaderboard" />
      </InsightsPage>
    );
  }

  if (!selectedSplitSpace) {
    return (
      <InsightsPage>
        {header}
        <InsightsNoGroup hasGroups={splitSpaces.length > 0} />
      </InsightsPage>
    );
  }

  if (error) {
    return (
      <InsightsPage>
        {header}
        <InsightsError error={error} onRetry={() => refetch()} />
      </InsightsPage>
    );
  }

  if (people.length === 0) {
    return (
      <InsightsPage>
        {header}
        <InsightsNoPeople />
      </InsightsPage>
    );
  }

  if (!data.hasPayments) {
    return (
      <InsightsPage>
        {header}
        <InsightsNoExpenses
          title="The leaderboard fills in once someone pays for something."
          description="Add an expense and see who's carrying the group."
        />
      </InsightsPage>
    );
  }

  const podium = data.topPayers.filter((p) => p.expenseCount > 0);

  return (
    <InsightsPage>
      {header}

      <div className="space-y-8">
        <Panel className="overflow-hidden pb-0 sm:pb-0">
          <h2 className="sr-only">Top payers</h2>
          <ol className="mx-auto flex max-w-xl items-end justify-center gap-2 pt-1 sm:gap-4">
            {podium.map((person, index) => (
              <PodiumStep key={person.id} person={person} place={(index + 1) as 1 | 2 | 3} />
            ))}
          </ol>
        </Panel>

        {badges.length > 0 && (
          <Section title="Badges">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map((badge) => (
                <li key={badge.key} className="flex min-w-0 items-start gap-3 rounded-xl border bg-card p-4 shadow-card">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl"
                  >
                    {badge.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-muted-foreground">{badge.title}</p>
                    <p className="truncate text-[15px] font-semibold">{badge.winner}</p>
                    <p className="text-[13px] tabular-nums text-muted-foreground">{badge.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Rankings">
          <Panel className="px-2 py-1 sm:px-3 sm:py-1">
            <ol className="divide-y divide-border/70">
              {data.ranked.map((person, index) => (
                <RankingRow key={person.id} person={person} rank={index + 1} />
              ))}
            </ol>
          </Panel>
        </Section>
      </div>
    </InsightsPage>
  );
}

const PODIUM = {
  1: { label: "1st", order: "order-2", step: "h-24 sm:h-32 border-primary/25 bg-primary/10 text-primary" },
  2: { label: "2nd", order: "order-1", step: "h-[72px] sm:h-24 bg-secondary text-foreground" },
  3: { label: "3rd", order: "order-3", step: "h-14 sm:h-20 bg-secondary text-foreground" },
} as const;

/** DOM order is 1st, 2nd, 3rd for screen readers; CSS order puts 1st in the middle. */
const PodiumStep = ({ person, place }: { person: PersonStats; place: 1 | 2 | 3 }) => {
  const config = PODIUM[place];
  return (
    <li className={cn("flex min-w-0 max-w-[11rem] flex-1 basis-0 flex-col items-center", config.order)}>
      <PersonAvatar name={person.name} size="lg" />
      <p className="mt-2 w-full truncate text-center text-sm font-semibold">{person.name}</p>
      <p className="text-sm font-medium tabular-nums">{formatMoneyCompact(person.totalPaid)}</p>
      <p className="text-xs text-muted-foreground">{pluralize(person.expenseCount, "expense")}</p>
      <div
        className={cn(
          "mt-3 flex w-full items-start justify-center rounded-t-lg border border-b-0 pt-2 text-sm font-semibold",
          config.step
        )}
      >
        <span>
          <span className="sr-only">Place: </span>
          {config.label}
        </span>
      </div>
    </li>
  );
};

const RankingRow = ({ person, rank }: { person: PersonStats; rank: number }) => (
  <li className="flex min-h-14 items-center gap-3 px-2 py-3">
    <span
      className={cn(
        "w-6 shrink-0 text-center text-sm font-semibold tabular-nums",
        rank === 1 ? "text-primary" : "text-muted-foreground"
      )}
    >
      {rank}
    </span>
    <PersonAvatar name={person.name} size="md" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-medium">{person.name}</p>
      <p className="truncate text-[13px] text-muted-foreground">
        {person.expenseCount > 0
          ? `${pluralize(person.expenseCount, "expense")} · biggest ${formatMoneyCompact(person.highestExpense)}`
          : "Hasn't paid for anything yet"}
      </p>
    </div>
    <span
      className={cn(
        "shrink-0 text-[15px] font-semibold tabular-nums",
        person.totalPaid === 0 && "font-medium text-muted-foreground"
      )}
    >
      {formatMoneyCompact(person.totalPaid)}
    </span>
  </li>
);
