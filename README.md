# Split Pro - Developer Documentation

A modern expense splitting application built with React, TypeScript, and Supabase.

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui (Radix UI components)
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **State Management**: React Context API + TanStack Query
- **Routing**: React Router v6
- **PDF Generation**: jsPDF + jspdf-autotable
- **Animations**: Framer Motion
- **Date Handling**: date-fns

## Project Structure

```
split_pro/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── Layout.tsx        # Main layout with navigation
│   │   ├── SplitSpaceSelector.tsx
│   │   └── EmailReportDialog.tsx
│   ├── contexts/            # React contexts
│   │   └── SplitSpaceContext.tsx
│   ├── hooks/               # Custom React hooks
│   ├── integrations/        # External service integrations
│   │   └── supabase/
│   ├── lib/                 # Utility functions
│   ├── pages/               # Page components
│   │   ├── Auth.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Expenses.tsx
│   │   ├── Reports.tsx
│   │   └── SplitSpaces.tsx
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── supabase/
│   ├── migrations/          # Database migrations
│   └── functions/           # Edge Functions
└── public/                  # Static assets
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
cd split_pro

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
# 2. 20251127031022_create_split_spaces.sql
# 3. 20251127031023_add_split_space_relations.sql
# 4. 20251127031024_migrate_existing_data.sql (only for existing data)
# 5. 20251127031025_fix_rls_for_migration.sql (only for existing data)
# 6. 20251127031026_auto_create_default_split_space.sql
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
- **flatmates**: People sharing expenses
- **expenses**: Individual expense records
- **expense_splits**: Many-to-many relationship between expenses and flatmates

### Key Features

- **Row Level Security (RLS)**: All tables secured with user-based policies
- **Automatic Default Space**: Created on user signup via trigger
- **Cascade Deletes**: Proper foreign key relationships
- **Unique Constraints**: Prevent duplicate split space names per user

## Key Features Implementation

### Split Spaces

- Users can create multiple expense groups
- Default space created automatically on signup
- Default space cannot be deleted
- All expenses and flatmates are scoped to a split space

### Expense Splitting

- Equal splitting among selected flatmates
- Automatic balance calculation
- Settlement algorithm minimizes transactions

### Reports

- Date range filtering
- Balance calculations
- Settlement instructions
- PDF export (summary and detailed)
- Email sending (via Edge Function)

## Authentication

- Supabase Auth handles user authentication
- Email/password authentication
- Automatic profile creation on signup
- Session management via Supabase client

## API Integration

### Supabase Client

All database operations use the Supabase JavaScript client:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Query example
const { data, error } = await supabase
  .from('expenses')
  .select('*')
  .eq('split_space_id', spaceId);
```

### Edge Functions

Email sending is handled via Supabase Edge Functions:
- Function: `send-settlement-email`
- Location: `supabase/functions/send-settlement-email/`

## State Management

### Context API

- **SplitSpaceContext**: Manages selected split space and list of spaces
- Provides: `selectedSplitSpace`, `splitSpaces`, `setSelectedSplitSpace`, `refreshSplitSpaces`

### React Query

Used for server state management and caching (configured but minimal usage currently).

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Pre-built accessible components
- **Custom Theme**: Configured in `tailwind.config.ts`
- **Responsive Design**: Mobile-first approach

## Code Quality

- **TypeScript**: Full type safety
- **ESLint**: Code linting configured
- **Component Structure**: Modular, reusable components

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

## Contributing

1. Follow TypeScript best practices
2. Use existing component patterns
3. Maintain RLS policies for new features
4. Write clear commit messages
5. Test on multiple screen sizes

## Troubleshooting

### Common Issues

**RLS Policy Errors**
- Check user authentication state
- Verify RLS policies match query patterns

**Migration Errors**
- Run migrations in order
- Check for existing data conflicts

**Build Errors**
- Clear `node_modules` and reinstall
- Check TypeScript version compatibility

## License

[Your License Here]

---

For user documentation, see [GUIDE.md](./GUIDE.md)
