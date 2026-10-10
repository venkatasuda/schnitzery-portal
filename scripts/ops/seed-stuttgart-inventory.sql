-- ============================================================================
-- REAL inventory catalogue for Schnitzery Stuttgart (branch 20b8cb3e…).
-- This is REAL operational data, NOT demo data — it is deliberately untagged
-- so cleanup-demo-data.sql leaves it alone.
--
-- Idempotent: re-running clears any prior load of these exact products on this
-- branch (and today's 'Setup' counts) and re-inserts. Run in the Supabase SQL
-- editor. Figures captured at initial setup; drinks have no stock figure yet.
-- ============================================================================
do $$
declare b uuid := '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6';
begin
  create temporary table _cat(category text, product text, ist numeric, soll numeric, unit text) on commit drop;
  insert into _cat(category, product, ist, soll, unit) values
  ('Drinks','Coca Cola',null,null,null),
  ('Drinks','Coca Cola Zero',null,null,null),
  ('Drinks','Elephant Bay Mango',null,null,null),
  ('Drinks','Elephant Bay Peach',null,null,null),
  ('Drinks','Elephant Bay Peach Zero',null,null,null),
  ('Drinks','Elephant Bay Watermelon',null,null,null),
  ('Drinks','Elephant Bay Blueberry',null,null,null),
  ('Drinks','Elephant Bay Lemon',null,null,null),
  ('Drinks','Elephant Bay Pomegranate',null,null,null),
  ('Drinks','Water (Sparkling)',null,null,null),
  ('Drinks','Water (Normal / Still)',null,null,null),
  ('Sauces, Dressings & Dips','Cheddar Sauce',102,50,'Stk.'),
  ('Sauces, Dressings & Dips','Garlic''n Spicy',17,50,'Eimer'),
  ('Sauces, Dressings & Dips','Honey Mustard',29,25,'Eimer'),
  ('Sauces, Dressings & Dips','Garlic Sauce',37,35,'Eimer'),
  ('Sauces, Dressings & Dips','Hot''n Spicy',0,100,'Eimer'),
  ('Sauces, Dressings & Dips','Käsesoße',2,6,'GN'),
  ('Sauces, Dressings & Dips','Mayonnaise',11,18,'Eimer'),
  ('Sauces, Dressings & Dips','Mayo Tütchen',2,1,'Karton'),
  ('Sauces, Dressings & Dips','Mango Curry',1,1,'Eimer'),
  ('Sauces, Dressings & Dips','Maggi',4,10,'Stk.'),
  ('Sauces, Dressings & Dips','Honig/Honey',13,10,'Glas'),
  ('Spices, Oils & Condiments','Öl/OIL',5,10,'Stk.'),
  ('Spices, Oils & Condiments','Frittieröl',55,40,'Kanister'),
  ('Spices, Oils & Condiments','Gewürzmischung/Spice mix',4,5,'Eimer'),
  ('Spices, Oils & Condiments','Currypulver/Currypowder',5,5,'Kg'),
  ('Spices, Oils & Condiments','Pommes Pulver/Fries Powder',6,10,'Paket'),
  ('Spices, Oils & Condiments','Pfeffer/Pepper',6,10,'Paket'),
  ('Spices, Oils & Condiments','Salz/Salt',6,10,'Paket'),
  ('Spices, Oils & Condiments','Zucker/Sugar',100,12,'Kg'),
  ('Spices, Oils & Condiments','Apfelessig/Apple Cider Vinegar',7,25,'Flasche'),
  ('Proteins & Meats','Fleisch/Meat',870,900,'kg'),
  ('Proteins & Meats','Fleisch mix',1,3,'Rollen'),
  ('Proteins & Meats','Fleisch paniert',105,300,'KG'),
  ('Proteins & Meats','Plant-Based Schnitzel',30,10,'Karton'),
  ('Dairy & Refrigerated Goods','Käse/Cheese',72,70,'Blöcke'),
  ('Dairy & Refrigerated Goods','Käse gerieben',2,12,'GN'),
  ('Dairy & Refrigerated Goods','Parmesan',12,7,'Kg'),
  ('Dairy & Refrigerated Goods','Butter',54,100,'Stk.'),
  ('Dairy & Refrigerated Goods','Milch/Milk',33,34,'Karton'),
  ('Dairy & Refrigerated Goods','Sahne/Cream',23,25,'Karton'),
  ('Dairy & Refrigerated Goods','Joghurt/Yogurt',13,25,'Eimer'),
  ('Dairy & Refrigerated Goods','Quark',13,25,'Eimer'),
  ('Dairy & Refrigerated Goods','Sahnesteif/Cream Stiffener',40,100,'Packung (5 Tüten)'),
  ('Produce & Vegetables','Salat',7,15,'Köpfe'),
  ('Produce & Vegetables','Rotkohl/Red cabbage',145,150,'kg'),
  ('Produce & Vegetables','Weißkohl/White cabbage',110,100,'kg'),
  ('Produce & Vegetables','Krautsalat',60,120,'KG'),
  ('Produce & Vegetables','Karotten/Carrots',20,30,'kg'),
  ('Produce & Vegetables','Knoblauch/Garlic',1,2,'Netze'),
  ('Produce & Vegetables','Jalapeños',18,20,'Gläser'),
  ('Produce & Vegetables','Mini-Peperoni',18,20,'Gläser'),
  ('Produce & Vegetables','Cornichons',6,20,'Gläser'),
  ('Produce & Vegetables','Mais/Corn',24,10,'Paket'),
  ('Produce & Vegetables','Röstzwiebeln/Fried Onion',58,50,'Karton'),
  ('Dry Goods, Grains & Baking','Mehl/Flour',5,7,'Paket'),
  ('Dry Goods, Grains & Baking','Paniermehl',250,350,'Kg'),
  ('Dry Goods, Grains & Baking','Nudeln',149,200,'Paket'),
  ('Dry Goods, Grains & Baking','Reis/Rice',5,5,'Karton'),
  ('Dry Goods, Grains & Baking','Pommes/Fries',13,35,'Karton'),
  ('Dry Goods, Grains & Baking','Wraps',26,8,'Paket'),
  ('Dry Goods, Grains & Baking','Brot',25,50,null),
  ('Dry Goods, Grains & Baking','Gemüsebrühe/Vegetable broth',9,10,'Stk.'),
  ('Dry Goods, Grains & Baking','Mango Pulp',10,12,'Dosen'),
  ('Dry Goods, Grains & Baking','Cheetos',0,3,'Karton'),
  ('Dry Goods, Grains & Baking','Ketchup Tütchen',2,1,'Karton'),
  ('Packaging, Consumables & Non-Food','Küchenrolle/Kitchen roll',70,40,'Rollen'),
  ('Packaging, Consumables & Non-Food','Alufolie/Aluminum foil',7,5,'Stk.'),
  ('Packaging, Consumables & Non-Food','Mülltüten/Garbage bags 130L',20,5,'Kartons'),
  ('Packaging, Consumables & Non-Food','Servietten/Napkins',20,25,'Kartons'),
  ('Packaging, Consumables & Non-Food','Tüten',93,40,'Karton'),
  ('Packaging, Consumables & Non-Food','Handschuhe/Gloves M',3,5,'Stk.'),
  ('Packaging, Consumables & Non-Food','Handschuhe/Gloves L',7,5,'Stk.'),
  ('Packaging, Consumables & Non-Food','Handschuhe/Gloves XL',55,5,'Stk.'),
  ('Packaging, Consumables & Non-Food','Kassenbonrollen/Receipt rolls',3,3,'Paket');

  delete from public.inventory_counts
   where branch_id = b and count_date = current_date
     and product in (select product from _cat);
  delete from public.inventory_master
   where branch_id = b and product in (select product from _cat);

  insert into public.inventory_master(branch_id, category, product, soll, unit, is_active)
  select b, category, product, soll, unit, true from _cat;

  insert into public.inventory_counts(branch_id, count_date, category, product, ist, soll, unit, counted_by)
  select b, current_date, category, product, ist, soll, unit, 'Setup'
    from _cat where ist is not null;
end $$;
