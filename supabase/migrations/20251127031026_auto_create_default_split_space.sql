-- Update handle_new_user function to also create a default split space
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
  
  RETURN NEW;
END;
$$;

-- Update RLS policy to prevent deletion of default split spaces
DROP POLICY IF EXISTS "Users can delete their own split spaces" ON public.split_spaces;
CREATE POLICY "Users can delete their own split spaces"
  ON public.split_spaces FOR DELETE
  USING (
    auth.uid() = created_by AND
    name != 'Default'
  );

