UPDATE public.items
SET photo = NULL
WHERE categorie_id IN (
  SELECT id
  FROM public.categories
  WHERE slug = 'cocktails-sans-alcool'
);
