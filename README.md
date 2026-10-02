# ExpenseWaale - Developer Documentation

A modern expense splitting application built with React, TypeScript, and Supabase. ExpenseWaale helps groups manage shared expenses with advanced filtering, analytics, and reporting capabilities.

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui (Radix UI components)
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **State Management**: React Context API + TanStack Query
- **Routing**: React Router v6
- **PDF Generation**: jsPDF + jspdf-autotable
- **Charting**: Recharts
- **Animations**: Framer Motion
- **Date Handling**: date-fns
- **Local Storage**: Custom hooks for filter persistence

## Project Structure

```
expensewaale/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── graphs/
│   │   │   └── ExpenseTrendGraph.tsx
│   │   ├── Layout.tsx       # App shell: sidebar (desktop), top bar + tab bar (phone)
│   │   ├── ExpenseSheet.tsx # The one add/edit expense form
│   │   ├── LedgerViews.tsx  # PaymentList (who pays whom) and BalanceList
│   │   ├── ReportControls.tsx # Period presets + filter panel for Balances/Insights
│   │   ├── SplitSpaceSelector.tsx
│   │   └── …                # ChoiceChip, PersonAvatar, ExpenseRow, ResponsiveDialog, …
│   ├── contexts/
│   │   ├── SplitSpaceContext.tsx   # Selected space
│   │   └── ExpenseSheetContext.tsx # Open the expense sheet from anywhere
│   ├── hooks/
│   │   ├── useSpaceData.ts         # Cached reads for the selected space (TanStack Query)
│   │   ├── useMe.ts                # Which person is "me" (per device)
│   │   ├── useReportFilters.ts     # Filter persistence (Balances + Insights)
│   │   └── useMyCostFilters.ts
│   ├── integrations/supabase/      # Generated client + types
│   ├── lib/
│   │   ├── settlement.ts    # Balance + settle-up maths (unchanged rules)
│   │   ├── ledger.ts        # Composes settlement.ts; open period since last settle-up
│   │   ├── mutations.ts     # Every write the UI makes
│   │   ├── format.ts        # ₹ and date formatting
│   │   ├── reportPdf.ts, pdfStyle.ts, shareText.ts  # Exports
│   │   └── db.ts            # Untyped handle + row types (types.ts is stale)
│   ├── pages/
│   │   ├── Auth.tsx         # Landing + sign in / create account
│   │   ├── Dashboard.tsx    # Home: where you stand + settle up
│   │   ├── Expenses.tsx
│   │   ├── People.tsx
│   │   ├── Reports.tsx      # "Balances"
│   │   ├── Analytics.tsx    # Insights › Spending
│   │   ├── MyCost.tsx       # Insights › Per person
│   │   ├── Leaderboard.tsx  # Insights › Leaderboard
│   │   ├── SplitSpaces.tsx
│   │   └── SharedReport.tsx # Public read-only snapshot
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── supabase/
│   ├── migrations/          # Database migrations
│   │   ├── 20251011172431_b7483597-622f-469b-9193-86fbe224ea33.sql
│   │   ├── 20251127031022_create_split_spaces.sql
│   │   ├── 20251127031023_add_split_space_relations.sql
│   │   ├── 20251127031024_migrate_existing_data.sql
│   │   ├── 20251127031025_fix_rls_for_migration.sql
│   │   ├── 20251127031026_auto_create_default_split_space.sql
│   │   └── 20251127031027_add_categories.sql
│   └── functions/           # Edge Functions
│       └── send-settlement-email/
├── public/                  # Static assets
├── GUIDE.md                 # User guide
└── README.md                # This file
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd expensewaale

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase credentials to .env
```

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

1. **Run Migrations**: Execute all SQL migration files in order:

```bash
# Migrations should be run in this order:
# 1. 20251011172431_b7483597-622f-469b-9193-86fbe224ea33.sql
#    - Creates profiles, flatmates, expenses, expense_splits tables
#    - Sets up RLS policies
#    - Creates handle_new_user trigger
# 2. 20251127031022_create_split_spaces.sql
#    - Creates split_spaces table
# 3. 20251127031023_add_split_space_relations.sql
#    - Adds split_space_id to flatmates and expenses
# 4. 20251127031024_migrate_existing_data.sql (only for existing data)
#    - Migrates existing data to default split space
# 5. 20251127031025_fix_rls_for_migration.sql (only for existing data)
#    - Temporarily adjusts RLS for migration
# 6. 20251127031026_auto_create_default_split_space.sql
#    - Updates handle_new_user to create default split space
#    - Prevents deletion of "Default" split space
# 7. 20251127031027_add_categories.sql
#    - Creates categories table
#    - Adds category_id to expenses
#    - Creates default categories for users
#    - Sets up category triggers
```

2. **Enable RLS**: All tables have Row Level Security enabled
3. **Set up Edge Functions** (optional): Deploy email sending function

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Database Schema

### Tables

- **profiles**: User profile information
- **split_spaces**: Expense groups/contexts
- **flatmates**: People sharing expenses (scoped to split_space_id)
- **expenses**: Individual expense records (scoped to split_space_id, includes category_id)
- **expense_splits**: Many-to-many relationship between expenses and flatmates
- **categories**: Expense categories (user-scoped, includes default categories)

### Key Features

- **Row Level Security (RLS)**: All tables secured with user-based policies
- **Automatic Default Space**: Created on user signup via trigger
- **Default Space Protection**: Cannot be deleted (enforced at DB and UI level)
- **Default Categories**: 8 categories created automatically for each user
- **Category Management**: Users can create custom categories, cannot delete default ones
- **Cascade Deletes**: Proper foreign key relationships
- **Unique Constraints**: Prevent duplicate split space names per user, category names per user

## Key Features Implementation

### Split Spaces

- Users can create multiple expense groups
- Default space created automatically on signup
- Default space cannot be deleted (DB + UI protection)
- All expenses and flatmates are scoped to a split space
- Split space selection persists in localStorage

### Expense Management

- Equal splitting among selected flatmates
- Category assignment (default or custom)
- One add/edit sheet reachable from every page (sidebar button, phone tab-bar +, or the N key); split defaults to everyone, payer defaults to "me" or the last payer, with a live "who owes whom" preview
- Automatic balance calculation
- Settlement algorithm minimizes transactions

### Categories

- 8 default categories: Food, Travel, Rent, Groceries, Utilities, Fuel, Shopping, Misc
- Custom category creation
- Category filtering in Reports and Analytics
- Category-wise analytics and insights
- Default categories cannot be deleted

### Balances Page (`/reports`)

- **Date Range Filtering**: Select custom date ranges
- **Period presets**: since last settle-up, this month, last month, all time, and every settled period
- **Inline filter panel** with removable chips:
  - People filters: Exact Match, Any Match, Exclude, Paid By (multi-select)
  - Category filters: Include/Exclude categories
  - Filter persistence in localStorage
- **Filtered Transactions List**:
  - Shows all matching expenses
  - Sort by Date, Amount, or Title (ascending/descending)
  - Additional "Paid By" quick filter
- **Balance Calculations**: Real-time balance updates based on filters
- **Settlement Instructions**: Minimum transaction calculations
- **PDF Export**: Detailed expense reports and settlement summaries
- **Email Sending**: an Edge Function exists, but the UI doesn't call it yet (the old dialog only simulated success, so it isn't exposed)
- **Copy to Clipboard**: Quick sharing of summaries

### Analytics Page

- **Key Metrics**: Spent, Per day, Per person, Biggest category (the fairness score is still in the PDF export, but no longer on screen: with rupee amounts it read 0 "Skewed" for almost any real data)
- **Category Breakdown**: Visual progress bars with percentages
- **Spending over time**: column chart (Day/Week/Month), empty periods shown as zero, with a table view
- **Top 5 Most Expensive Days**: Identifies spending spikes
- **Advanced Filtering**: Same filters as Reports page
- **PDF Export**: Comprehensive analytics summary
- All analytics respect applied filters

### Leaderboard Page

- **Top 3 Payers**: podium
- **Fun Stats**:
  - Most Generous (highest total paid)
  - Silent Assassin (lowest paid but active)
  - Big Spender (highest single expense)
- **Category Badges**:
  - Milk Bhai (Groceries leader)
  - Fuel King (Fuel leader)
  - Foodie (Food leader)
- **PDF Export**: Leaderboard summary

### Filter Persistence

- Custom hook `useReportFilters` manages filter state
- Automatically saves to localStorage on changes
- Loads from localStorage on initialization
- Persists across page reloads and navigation
- Shared between Reports and Analytics pages

## Authentication

- Supabase Auth handles user authentication
- Email/password authentication
- Automatic profile creation on signup
- Automatic default split space creation on signup
- Automatic default categories creation on signup
- Session management via Supabase client

## API Integration

### Supabase Client

All database operations use the Supabase JavaScript client:

```typescript
import { supabase } from "@/integrations/supabase/client";

// Query example with categories
const { data, error } = await supabase
  .from("expenses")
  .select(
    `
    *,
    categories (name),
    expense_splits (flatmate_id)
  `
  )
  .eq("split_space_id", spaceId);
```

### Edge Functions

Email sending is handled via Supabase Edge Functions:

- Function: `send-settlement-email`
- Location: `supabase/functions/send-settlement-email/`
- Supports individual and comprehensive reports

## State Management

### Context API

- **SplitSpaceContext**: Manages selected split space and list of spaces
  - Provides: `selectedSplitSpace`, `splitSpaces`, `setSelectedSplitSpace`, `refreshSplitSpaces`
  - Persists selection in localStorage

### Custom Hooks

- **useReportFilters**: Manages filter state and persistence
  - People filters (exactMatch, anyMatch, exclude, paidBy)
  - Category filters (include, exclude)
  - Date range
  - Auto-saves to localStorage

### React Query

`useSpaceData` caches flatmates, expenses, settlements and categories per space, so moving between pages is instant. Writes invalidate through `useRefreshSpaceData`.

## Component Architecture

### Reusable Components

- **ExpenseSheet**: add/edit expense (bottom sheet on phones, dialog on desktop)
- **PaymentList / BalanceList**: who pays whom, and everyone's position in words
- **ReportControls**: period presets, filter panel, active-filter chips
- **PeopleFilters / CategoryFilterSection**: controlled filter chip groups
- **ResponsiveDialog**, **ChoiceChip**, **PersonAvatar**, **ExpenseRow**, **EmptyState**, **PageHeader**
- **ExpenseTrendGraph**: spending chart with a table view
- **SplitSpaceSelector**: space switcher

### Page Components

- **Dashboard** (Home): your position, settle-up plan, recent expenses; first-run setup
- **Expenses**: list grouped by month with search, person and category filters
- **People**: add/edit/remove people, "this is me"
- **Reports** (Balances): period + filters, settle up, balances, exports, settled periods
- **Analytics / MyCost / Leaderboard**: the three Insights tabs
- **SplitSpaces**: space management
- **SharedReport**: public snapshot with "find your share"

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Pre-built accessible components
- **Custom Theme**: Configured in `tailwind.config.ts`
- **Responsive Design**: Mobile-first approach
- **Design tokens**: `src/index.css` (`--positive` / `--negative` for money direction, `--sage` for the brand accent). There's no dark theme yet.

## Data Flow

1. **Expense Creation**: ExpenseSheet → `lib/mutations.ts` → Supabase → query invalidation → every page re-renders from the cache
2. **Filtering**: User → Filter Selection → localStorage → Filter Logic → Filtered Data → UI Update
3. **Analytics**: Filtered Expenses → Calculations → Charts/Metrics → Display
4. **Balances**: Filtered Expenses → `calculateBalances` → `calculateSettlements` → screen / PDF / copied text / share snapshot

## Code Quality

- **TypeScript**: Full type safety
- **ESLint**: Code linting configured
- **Component Structure**: Modular, reusable components
- **Error Handling**: Toast notifications for user feedback
- **Loading States**: Proper loading indicators throughout

## Deployment

### Build Process

```bash
npm run build
```

Output: `dist/` directory with optimized production build

### Environment Considerations

- Ensure environment variables are set in production
- Configure Supabase CORS settings
- Set up Edge Functions if using email features
- Verify RLS policies in production
- Test filter persistence across browsers

## Key Technical Decisions

1. **Filter Persistence**: localStorage hook for seamless UX
2. **Client-Side Filtering**: Applied after data fetch for flexibility
3. **Category System**: User-scoped with defaults for consistency
4. **Chart Library**: Recharts for responsive, interactive charts
5. **PDF Generation**: jsPDF with autoTable for professional reports
6. **Modal Filters**: Better UX than collapsible sections

## Contributing

1. Follow TypeScript best practices
2. Use existing component patterns
3. Maintain RLS policies for new features
4. Write clear commit messages
5. Test on multiple screen sizes
6. Ensure filter persistence works correctly
7. Update types when adding database changes

## Troubleshooting

### Common Issues

**RLS Policy Errors**

- Check user authentication state
- Verify RLS policies match query patterns
- Ensure split_space_id is included in queries

**Migration Errors**

- Run migrations in order
- Check for existing data conflicts
- Verify foreign key relationships

**Filter Not Persisting**

- Check browser localStorage support
- Verify useReportFilters hook is used correctly
- Check for localStorage quota issues

**Category Errors**

- Ensure categories migration has run
- Check that default categories exist for user
- Verify category_id foreign key relationship

**Build Errors**

- Clear `node_modules` and reinstall
- Check TypeScript version compatibility
- Regenerate Supabase types after schema changes

**Chart Not Rendering**

- Verify Recharts is installed
- Check data format matches chart expectations
- Ensure responsive container has dimensions

## License

[Your License Here]

---

For user documentation, see [GUIDE.md](./GUIDE.md)
