-- Create profiles table for admin user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create flatmates table
CREATE TABLE public.flatmates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.flatmates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their flatmates"
  ON public.flatmates FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create flatmates"
  ON public.flatmates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their flatmates"
  ON public.flatmates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their flatmates"
  ON public.flatmates FOR DELETE
  USING (auth.uid() = created_by);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  paid_by UUID REFERENCES public.flatmates(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = created_by);

-- Create expense_splits table to track who is involved in each expense
CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  flatmate_id UUID REFERENCES public.flatmates(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expense_id, flatmate_id)
);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their expense splits"
  ON public.expense_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_splits.expense_id
      AND expenses.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create expense splits"
  ON public.expense_splits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_splits.expense_id
      AND expenses.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete expense splits"
  ON public.expense_splits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_splits.expense_id
      AND expenses.created_by = auth.uid()
    )
  );

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();