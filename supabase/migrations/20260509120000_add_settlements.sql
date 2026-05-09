-- Create settlements table
-- Records date ranges that the user has marked as "settled" so they know
-- where the next settlement should pick up. Scoped per split space.
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_space_id UUID NOT NULL REFERENCES public.split_spaces(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX settlements_space_created_idx
  ON public.settlements (split_space_id, created_at DESC);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settlements"
  ON public.settlements FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own settlements"
  ON public.settlements FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own settlements"
  ON public.settlements FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own settlements"
  ON public.settlements FOR DELETE
  USING (auth.uid() = created_by);
