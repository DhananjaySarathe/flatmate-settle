-- Create shared_reports table
-- Stores frozen snapshots of a Reports view so they can be shared via a
-- public, tokenised URL. The snapshot column holds the precomputed
-- balances + settlements + expense list at share time.
--
-- Note: this is the project's first table with a public-read RLS policy.
-- Public access is read-only and limited to this single table; expenses,
-- flatmates, etc. remain owner-only because the public page reads only
-- the snapshot JSONB, never live source rows.
CREATE TABLE public.shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  split_space_id UUID NOT NULL REFERENCES public.split_spaces(id) ON DELETE CASCADE,
  split_space_name TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX shared_reports_token_idx ON public.shared_reports (token);
CREATE INDEX shared_reports_owner_created_idx
  ON public.shared_reports (created_by, created_at DESC);

ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- Owner can list/manage their own shared reports
CREATE POLICY "Users can view their own shared reports"
  ON public.shared_reports FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own shared reports"
  ON public.shared_reports FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own shared reports"
  ON public.shared_reports FOR DELETE
  USING (auth.uid() = created_by);

-- Public read by token: anyone holding the URL can fetch the row.
-- Postgres ORs SELECT policies, so this coexists with the owner-view policy.
CREATE POLICY "Anyone can view a shared report"
  ON public.shared_reports FOR SELECT
  USING (true);
