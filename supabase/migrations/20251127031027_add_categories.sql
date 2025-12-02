-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, created_by)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Users can view their own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = created_by);

-- Add category_id column to expenses table
ALTER TABLE public.expenses
  ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create function to get or create default categories for a user
CREATE OR REPLACE FUNCTION public.ensure_default_categories(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_categories TEXT[] := ARRAY['Food', 'Travel', 'Rent', 'Groceries', 'Utilities', 'Fuel', 'Shopping', 'Misc'];
  cat_name TEXT;
BEGIN
  FOREACH cat_name IN ARRAY default_categories
  LOOP
    INSERT INTO public.categories (name, created_by, is_default)
    VALUES (cat_name, user_id, TRUE)
    ON CONFLICT (name, created_by) DO NOTHING;
  END LOOP;
END;
$$;

-- Create function to get default Misc category for a user
CREATE OR REPLACE FUNCTION public.get_default_category_id(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  misc_category_id UUID;
BEGIN
  -- Ensure default categories exist
  PERFORM public.ensure_default_categories(user_id);
  
  -- Get Misc category ID
  SELECT id INTO misc_category_id
  FROM public.categories
  WHERE name = 'Misc' AND created_by = user_id
  LIMIT 1;
  
  RETURN misc_category_id;
END;
$$;

-- Update existing expenses to have Misc category
DO $$
DECLARE
  user_record RECORD;
  misc_id UUID;
BEGIN
  FOR user_record IN SELECT DISTINCT created_by FROM public.expenses WHERE category_id IS NULL
  LOOP
    -- Ensure default categories exist for this user
    PERFORM public.ensure_default_categories(user_record.created_by);
    
    -- Get Misc category ID for this user
    SELECT id INTO misc_id
    FROM public.categories
    WHERE name = 'Misc' AND created_by = user_record.created_by
    LIMIT 1;
    
    -- Update expenses without category
    UPDATE public.expenses
    SET category_id = misc_id
    WHERE created_by = user_record.created_by AND category_id IS NULL;
  END LOOP;
END $$;

-- Update handle_new_user function to create default categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Create default split space
  INSERT INTO public.split_spaces (name, created_by)
  VALUES ('Default', NEW.id)
  ON CONFLICT (name, created_by) DO NOTHING;
  
  -- Create default categories
  PERFORM public.ensure_default_categories(NEW.id);
  
  RETURN NEW;
END;
$$;

