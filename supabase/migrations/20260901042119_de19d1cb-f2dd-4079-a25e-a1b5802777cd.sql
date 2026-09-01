CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cash uuid; v_bkash uuid; v_bank uuid; v_wife uuid;
  v_salary uuid; v_freelance uuid; v_business uuid; v_allowance uuid; v_gift uuid; v_other_income uuid;
  v_food uuid; v_transport uuid; v_shopping uuid; v_education uuid; v_health uuid; v_ent uuid; v_bills uuid; v_personal uuid; v_other uuid;
  v_sub_family_food uuid; v_sub_restaurant uuid; v_sub_outside uuid; v_sub_snacks uuid;
  v_sub_rickshaw uuid; v_sub_travel uuid; v_sub_ride uuid;
  v_sub_shop_personal uuid;
  v_sub_course uuid;
  v_sub_grooming uuid; v_sub_personal_items uuid;
  v_sub_movie uuid; v_sub_hangout uuid;
  v_sub_misc uuid;
  v_event uuid;
  m date := date_trunc('month', now())::date;
  pm date := (date_trunc('month', now()) - interval '1 month')::date;
begin
  insert into public.profiles (user_id, name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email,'user'),'@',1)), new.email);

  insert into public.accounts (user_id, name, type, opening_balance) values (new.id, 'Cash', 'cash', 35000) returning id into v_cash;
  insert into public.accounts (user_id, name, type, opening_balance) values (new.id, 'My bKash', 'mobile_wallet', 3000) returning id into v_bkash;
  insert into public.accounts (user_id, name, type, opening_balance) values (new.id, 'My Bank', 'bank', 20000) returning id into v_bank;
  insert into public.accounts (user_id, name, type, opening_balance) values (new.id, 'Wife''s Account', 'other', 5000) returning id into v_wife;

  insert into public.income_categories (user_id, name, is_default) values (new.id, 'Salary', true) returning id into v_salary;
  insert into public.income_categories (user_id, name, is_default) values (new.id, 'Freelancing', true) returning id into v_freelance;
  insert into public.income_categories (user_id, name, is_default) values (new.id, 'Business', true) returning id into v_business;
  insert into public.income_categories (user_id, name, is_default) values (new.id, 'Allowance / Pocket Money', true) returning id into v_allowance;
  insert into public.income_categories (user_id, name, is_default) values (new.id, 'Gift', true) returning id into v_gift;
  insert into public.income_categories (user_id, name, is_default) values (new.id, 'Other', true) returning id into v_other_income;

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Food', true) returning id into v_food;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_food, new.id, s, true from unnest(array['Personal Food','Family Food','Wife','Outside Food','Restaurant','Snacks','Tea/Coffee','Other']) as s;
  select id into v_sub_family_food from public.expense_subcategories where category_id = v_food and name = 'Family Food';
  select id into v_sub_restaurant from public.expense_subcategories where category_id = v_food and name = 'Restaurant';
  select id into v_sub_outside from public.expense_subcategories where category_id = v_food and name = 'Outside Food';
  select id into v_sub_snacks from public.expense_subcategories where category_id = v_food and name = 'Snacks';

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Transport', true) returning id into v_transport;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_transport, new.id, s, true from unnest(array['Bus','CNG','Rickshaw','Bike','Fuel','Ride Sharing','Travel','Other']) as s;
  select id into v_sub_rickshaw from public.expense_subcategories where category_id = v_transport and name = 'Rickshaw';
  select id into v_sub_travel from public.expense_subcategories where category_id = v_transport and name = 'Travel';
  select id into v_sub_ride from public.expense_subcategories where category_id = v_transport and name = 'Ride Sharing';

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Shopping', true) returning id into v_shopping;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_shopping, new.id, s, true from unnest(array['Personal','Wife','Family','Clothing','Electronics','Other']) as s;
  select id into v_sub_shop_personal from public.expense_subcategories where category_id = v_shopping and name = 'Personal';

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Education', true) returning id into v_education;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_education, new.id, s, true from unnest(array['University','Course','Books','Exam','Other']) as s;
  select id into v_sub_course from public.expense_subcategories where category_id = v_education and name = 'Course';

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Health', true) returning id into v_health;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_health, new.id, s, true from unnest(array['Medicine','Doctor','Medical Test','Other']) as s;

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Entertainment', true) returning id into v_ent;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_ent, new.id, s, true from unnest(array['Movie','Gaming','Tour','Hangout','Other']) as s;
  select id into v_sub_movie from public.expense_subcategories where category_id = v_ent and name = 'Movie';
  select id into v_sub_hangout from public.expense_subcategories where category_id = v_ent and name = 'Hangout';

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Bills', true) returning id into v_bills;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_bills, new.id, s, true from unnest(array['Mobile','Internet','Electricity','Other']) as s;

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Personal', true) returning id into v_personal;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_personal, new.id, s, true from unnest(array['Grooming','Mobile Recharge','Personal Items','Other']) as s;
  select id into v_sub_grooming from public.expense_subcategories where category_id = v_personal and name = 'Grooming';
  select id into v_sub_personal_items from public.expense_subcategories where category_id = v_personal and name = 'Personal Items';

  insert into public.expense_categories (user_id, name, is_default) values (new.id, 'Other', true) returning id into v_other;
  insert into public.expense_subcategories (category_id, user_id, name, is_default)
    select v_other, new.id, s, true from unnest(array['Miscellaneous','Other']) as s;
  select id into v_sub_misc from public.expense_subcategories where category_id = v_other and name = 'Miscellaneous';

  insert into public.events (user_id, name, description, start_date, end_date)
  values (new.id, 'Kuakata Tour', 'Demo event — family trip to Kuakata sea beach', m + 11, m + 14)
  returning id into v_event;

  insert into public.transactions (user_id, type, amount, transaction_date, income_source_id, account_id, note) values
    (new.id, 'income', 25000, m + 1, v_salary, v_bank, 'Monthly salary'),
    (new.id, 'income', 3000, m + 5, v_allowance, v_cash, 'Monthly pocket money from home'),
    (new.id, 'income', 2000, m + 10, v_freelance, v_bkash, 'Freelance project payment');

  insert into public.transactions (user_id, type, amount, transaction_date, category_id, subcategory_id, account_id, event_id, note) values
    (new.id, 'expense', 1500, m + 3, v_food, v_sub_family_food, v_cash, null, 'Weekly groceries'),
    (new.id, 'expense', 800, m + 8, v_food, v_sub_restaurant, v_bkash, null, 'Dinner with friends'),
    (new.id, 'expense', 400, m + 18, v_food, v_sub_snacks, v_cash, null, null),
    (new.id, 'expense', 100, m + 2, v_transport, v_sub_rickshaw, v_cash, null, null),
    (new.id, 'expense', 2000, m + 6, v_education, v_sub_course, v_bkash, null, 'Online course'),
    (new.id, 'expense', 900, m + 9, v_personal, v_sub_grooming, v_cash, null, null),
    (new.id, 'expense', 600, m + 16, v_personal, v_sub_personal_items, v_cash, null, null),
    (new.id, 'expense', 400, m + 15, v_ent, v_sub_movie, v_bkash, null, null),
    (new.id, 'expense', 500, m + 20, v_ent, v_sub_hangout, v_cash, null, null),
    (new.id, 'expense', 450, m + 12, v_food, v_sub_outside, v_cash, v_event, 'Lunch at beach'),
    (new.id, 'expense', 1050, m + 13, v_food, v_sub_outside, v_cash, v_event, 'Seafood dinner'),
    (new.id, 'expense', 1200, m + 12, v_transport, v_sub_travel, v_cash, v_event, 'Bus to Kuakata'),
    (new.id, 'expense', 500, m + 14, v_transport, v_sub_ride, v_bkash, v_event, 'Local rides'),
    (new.id, 'expense', 800, m + 13, v_shopping, v_sub_shop_personal, v_cash, v_event, 'Beach shopping'),
    (new.id, 'expense', 2000, m + 13, v_other, v_sub_misc, v_bank, v_event, 'Hotel booking'),
    (new.id, 'expense', 300, m + 14, v_other, v_sub_misc, v_cash, v_event, 'Entry fees and misc');

  insert into public.transactions (user_id, type, amount, transaction_date, from_account_id, to_account_id, transfer_purpose, note) values
    (new.id, 'transfer', 5000, m + 4, v_cash, v_bkash, 'Personal Savings', 'Saving in My bKash'),
    (new.id, 'transfer', 5000, m + 7, v_cash, v_wife, 'Family Savings', 'Saving in Wife''s Account');

  insert into public.budgets (user_id, year, month, category_id, amount) values
    (new.id, extract(year from m)::int, extract(month from m)::int, v_food, 5000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_transport, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_shopping, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_education, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_ent, 1500),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_personal, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_other, 1000);

  insert into public.transactions (user_id, type, amount, transaction_date, income_source_id, account_id, note) values
    (new.id, 'income', 28000, pm + 1, v_salary, v_bank, 'Monthly salary');
  insert into public.transactions (user_id, type, amount, transaction_date, category_id, subcategory_id, account_id, note) values
    (new.id, 'expense', 6000, pm + 4, v_food, v_sub_family_food, v_cash, 'Groceries and meals'),
    (new.id, 'expense', 2500, pm + 8, v_transport, v_sub_ride, v_bkash, null),
    (new.id, 'expense', 4000, pm + 12, v_shopping, v_sub_shop_personal, v_bank, 'Clothing'),
    (new.id, 'expense', 2000, pm + 15, v_bills, v_sub_misc, v_bkash, 'Utility bills'),
    (new.id, 'expense', 1500, pm + 18, v_personal, v_sub_grooming, v_cash, null),
    (new.id, 'expense', 1500, pm + 22, v_education, v_sub_course, v_bank, 'Exam fee');
  insert into public.transactions (user_id, type, amount, transaction_date, from_account_id, to_account_id, transfer_purpose) values
    (new.id, 'transfer', 4000, pm + 10, v_cash, v_bkash, 'Personal Savings'),
    (new.id, 'transfer', 3000, pm + 15, v_bank, v_wife, 'Family Savings');

  return new;
end $function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;