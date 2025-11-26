-- Fix RLS policies to allow NULL split_space_id during migration
-- This allows access to data that hasn't been migrated yet

-- Update RLS policies for flatmates to allow NULL split_space_id
DROP POLICY IF EXISTS "Users can view their flatmates" ON public.flatmates;
CREATE POLICY "Users can view their flatmates"
  ON public.flatmates FOR SELECT
  USING (
    auth.uid() = created_by AND
    (
      flatmates.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = flatmates.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can create flatmates" ON public.flatmates;
CREATE POLICY "Users can create flatmates"
  ON public.flatmates FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    (
      flatmates.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = flatmates.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their flatmates" ON public.flatmates;
CREATE POLICY "Users can update their flatmates"
  ON public.flatmates FOR UPDATE
  USING (
    auth.uid() = created_by AND
    (
      flatmates.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = flatmates.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their flatmates" ON public.flatmates;
CREATE POLICY "Users can delete their flatmates"
  ON public.flatmates FOR DELETE
  USING (
    auth.uid() = created_by AND
    (
      flatmates.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = flatmates.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

-- Update RLS policies for expenses to allow NULL split_space_id
DROP POLICY IF EXISTS "Users can view their expenses" ON public.expenses;
CREATE POLICY "Users can view their expenses"
  ON public.expenses FOR SELECT
  USING (
    auth.uid() = created_by AND
    (
      expenses.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = expenses.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can create expenses" ON public.expenses;
CREATE POLICY "Users can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    (
      expenses.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = expenses.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their expenses" ON public.expenses;
CREATE POLICY "Users can update their expenses"
  ON public.expenses FOR UPDATE
  USING (
    auth.uid() = created_by AND
    (
      expenses.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = expenses.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their expenses" ON public.expenses;
CREATE POLICY "Users can delete their expenses"
  ON public.expenses FOR DELETE
  USING (
    auth.uid() = created_by AND
    (
      expenses.split_space_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.split_spaces
        WHERE split_spaces.id = expenses.split_space_id
        AND split_spaces.created_by = auth.uid()
      )
    )
  );

