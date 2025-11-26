-- Create default SplitSpace for each existing user
INSERT INTO public.split_spaces (name, created_by)
SELECT DISTINCT
  'Default' as name,
  created_by
FROM public.flatmates
WHERE created_by IS NOT NULL
ON CONFLICT (name, created_by) DO NOTHING;

-- Also create for users who only have expenses but no flatmates
INSERT INTO public.split_spaces (name, created_by)
SELECT DISTINCT
  'Default' as name,
  created_by
FROM public.expenses
WHERE created_by IS NOT NULL
  AND created_by NOT IN (SELECT created_by FROM public.split_spaces)
ON CONFLICT (name, created_by) DO NOTHING;

-- Migrate existing flatmates to default SplitSpace
UPDATE public.flatmates
SET split_space_id = (
  SELECT id FROM public.split_spaces
  WHERE split_spaces.created_by = flatmates.created_by
  AND split_spaces.name = 'Default'
  LIMIT 1
)
WHERE split_space_id IS NULL;

-- Migrate existing expenses to default SplitSpace
UPDATE public.expenses
SET split_space_id = (
  SELECT id FROM public.split_spaces
  WHERE split_spaces.created_by = expenses.created_by
  AND split_spaces.name = 'Default'
  LIMIT 1
)
WHERE split_space_id IS NULL;

-- Now make split_space_id NOT NULL
ALTER TABLE public.flatmates
  ALTER COLUMN split_space_id SET NOT NULL;

ALTER TABLE public.expenses
  ALTER COLUMN split_space_id SET NOT NULL;

