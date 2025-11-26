-- Create split_spaces table
CREATE TABLE public.split_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, created_by)
);

ALTER TABLE public.split_spaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies for split_spaces
CREATE POLICY "Users can view their own split spaces"
  ON public.split_spaces FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own split spaces"
  ON public.split_spaces FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own split spaces"
  ON public.split_spaces FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own split spaces"
  ON public.split_spaces FOR DELETE
  USING (auth.uid() = created_by);

