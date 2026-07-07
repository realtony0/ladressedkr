UPDATE public.categories
SET nom = 'Menu Bar', icone = 'GlassWater', ordre = 8
WHERE restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
  AND slug = 'cocktails-sans-alcool';

WITH bar_category AS (
  SELECT id, restaurant_id
  FROM public.categories
  WHERE restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
    AND slug = 'cocktails-sans-alcool'
),
new_subcategories AS (
  SELECT *
  FROM (
    VALUES
      ('Virgin Cocktail', 1),
      ('Smoothies', 2),
      ('Cocktails glacés', 3),
      ('Milkshakes', 4),
      ('Frappuccino', 5),
      ('Boissons chaudes', 6),
      ('Soda et jus', 7),
      ('Eaux minérales', 8)
  ) AS v(nom, ordre)
)
INSERT INTO public.subcategories (nom, ordre, categorie_id, restaurant_id)
SELECT n.nom, n.ordre, b.id, b.restaurant_id
FROM new_subcategories n
CROSS JOIN bar_category b
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subcategories s
  WHERE s.restaurant_id = b.restaurant_id
    AND s.categorie_id = b.id
    AND s.nom = n.nom
);

WITH ctx AS (
  SELECT '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid AS restaurant_id
),
cat AS (
  SELECT c.id, c.slug
  FROM public.categories c
  JOIN ctx ON c.restaurant_id = ctx.restaurant_id
),
sub AS (
  SELECT s.id, s.nom
  FROM public.subcategories s
  JOIN ctx ON s.restaurant_id = ctx.restaurant_id
)
INSERT INTO public.items (
  nom,
  description,
  prix,
  photo,
  categorie_id,
  subcategorie_id,
  disponible,
  allergenes,
  a_accompagnement,
  restaurant_id,
  plat_du_jour
)
SELECT
  v.nom,
  v.description,
  v.prix,
  NULL,
  cat.id,
  sub.id,
  true,
  ARRAY[]::text[],
  false,
  v.restaurant_id,
  false
FROM (
  VALUES
    ('TERANGA', 'Jus de bouye, mangue, menthe fraîche, passion.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('BISSAP SUNRISE', 'Bissap, jus d''ananas, jus d''orange, sirop de vanille.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Boom Passion', 'Jus d''agrumes, citron vert, sirop de passion, Sprite.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Ginger vibes', 'Ananas, passion, citron, gingembre.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Coconut ups', 'Ananas, lait de coco, crème, gingembre.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('After glow', 'Orange, ananas, gingembre.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Limonada', 'Citron, sucre de canne, menthe.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Romantica', 'Bissap, goyave, menthe.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Passion Breez', 'Jus de fruit de la passion, jus d''orange, cranberry.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Exotique', 'Jus de mangue, jus de fruit de la passion, jus de goyave, grenadine.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Virgin Piña Colada', 'Ananas frais, lait de coco, glace pilée.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Virgin Mojito Classique', 'Menthe fraîche, citron vert, sucre de canne, eau pétillante.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Virgin Mojito Fraise', 'Menthe fraîche, fraise, citron vert, sucre de canne, eau pétillante.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Virgin Mojito Passion', 'Menthe fraîche, fruit de la passion, citron vert, eau pétillante.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Virgin Spritz Chic', 'Jus d''orange frais, fleur de sureau sans alcool, eau pétillante.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Passion Fizz', 'Fruit de la passion, citron vert, eau pétillante.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Ginger Lemon', 'Citron pressé, ginger beer, sucre léger.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Red Velvet', 'Fraise, framboise, citron, touche de vanille.', 4000, 'Virgin Cocktail', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Paradise', 'Mangue, ananas, banane, lait de coco.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Rose', 'Fraise, banane, lait de coco.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Nioko book', 'Mangue, orange, ananas.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Energy Smoothie', 'Mangue, ananas, gingembre, jus d''orange, miel.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Detox', 'Fruits rouges, banane, lait de coco, gingembre, miel.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Summer Smoothie', 'Fraise, sirop de fraise, jus d''ananas.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Piña Banane', 'Banane, ananas, jus d''ananas, lait de coco.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Strawberry Colada', 'Fraise, banane, ananas, jus d''ananas, lait de coco.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Raspberry Sunrise', 'Framboise, mangue, jus d''orange.', 4000, 'Smoothies', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Citric', 'Sorbet framboise, sorbet citron mixés avec jus d''orange.', 4000, 'Cocktails glacés', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Tropical', 'Sorbet mangue, sorbet citron mixés avec jus d''orange, kiwi et banane.', 4000, 'Cocktails glacés', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Mangolito', 'Sorbet fruit de la passion, sorbet mangue, soda water.', 4000, 'Cocktails glacés', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Vanille', 'Vanille, lait.', 5000, 'Milkshakes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Vanille choco', 'Vanille, chocolat, lait.', 5000, 'Milkshakes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Double chocolat', 'Vanille, chocolat, chocolat noir, lait.', 5000, 'Milkshakes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Métisse', 'Vanille, caramel, lait.', 5000, 'Milkshakes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Mocha', 'Expresso, lait, sirop de chocolat, crème fouettée.', 4000, 'Frappuccino', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Caramel', 'Expresso, lait, sirop de caramel, crème fouettée.', 4000, 'Frappuccino', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Expresso', 'Expresso.', 1500, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Thé Infusion', 'Thé infusion.', 1500, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Café au lait', 'Café au lait.', 2000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Lait chaud', 'Lait chaud.', 2000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Double Café', 'Double café.', 3000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Cappuccino', 'Cappuccino.', 2500, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Cappuccino Viennois', 'Cappuccino viennois.', 3000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Thé Glacé', 'Thé glacé.', 2000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Café Viennois', 'Café viennois.', 2000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Noisette', 'Café noisette.', 2000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Chocolat Chaud', 'Chocolat chaud.', 2500, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Caramel Macchiato', 'Caramel macchiato.', 3000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Mocha Café', 'Expresso, lait, sirop de chocolat, crème fouettée.', 3000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Affogato', 'Expresso, glace vanille, crème fouettée.', 3000, 'Boissons chaudes', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Boisson gazeuse', 'Coca, Fanta, Sprite, tonic, soda water.', 2000, 'Soda et jus', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Red Bull', 'Red Bull.', 2500, 'Soda et jus', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Jus locaux', 'Bissap, bouye, ginger.', 2000, 'Soda et jus', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Jus pressé', 'Orange, pamplemousse, citron.', 3000, 'Soda et jus', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Eau locale 1.5 L', 'Eau minérale locale 1.5 L.', 1500, 'Eaux minérales', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Eau importée 1.5 L', 'Eau minérale importée 1.5 L.', 2500, 'Eaux minérales', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Eau gazeuse', 'Eau gazeuse.', 3000, 'Eaux minérales', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid),
    ('Perrier 33 cl', 'Perrier 33 cl.', 3000, 'Eaux minérales', '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'::uuid)
) AS v(nom, description, prix, sub_name, restaurant_id)
JOIN cat ON cat.slug = 'cocktails-sans-alcool'
JOIN sub ON sub.nom = v.sub_name
ON CONFLICT (restaurant_id, nom) DO UPDATE SET
  description = EXCLUDED.description,
  prix = EXCLUDED.prix,
  photo = NULL,
  categorie_id = EXCLUDED.categorie_id,
  subcategorie_id = EXCLUDED.subcategorie_id,
  disponible = true,
  allergenes = ARRAY[]::text[],
  a_accompagnement = false,
  plat_du_jour = false;

DELETE FROM public.subcategories s
USING public.categories c
WHERE s.categorie_id = c.id
  AND c.restaurant_id = '8f7c1bf8-feb5-4f34-88fb-781f2fd89d55'
  AND c.slug = 'cocktails-sans-alcool'
  AND s.nom IN ('Virgins', 'Cocktails')
  AND NOT EXISTS (
    SELECT 1
    FROM public.items i
    WHERE i.subcategorie_id = s.id
  );
