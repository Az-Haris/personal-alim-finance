create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type text not null default 'cash' check (type in ('cash','mobile_wallet','bank','other')),
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;
alter table public.accounts enable row level security;
create policy "Users manage own accounts" on public.accounts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index accounts_user_idx on public.accounts(user_id);

create table public.income_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.income_categories to authenticated;
grant all on public.income_categories to service_role;
alter table public.income_categories enable row level security;
create policy "Users manage own income categories" on public.income_categories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index income_categories_user_idx on public.income_categories(user_id);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;
alter table public.expense_categories enable row level security;
create policy "Users manage own expense categories" on public.expense_categories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index expense_categories_user_idx on public.expense_categories(user_id);

create table public.expense_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expense_subcategories to authenticated;
grant all on public.expense_subcategories to service_role;
alter table public.expense_subcategories enable row level security;
create policy "Users manage own subcategories" on public.expense_subcategories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index expense_subcategories_category_idx on public.expense_subcategories(category_id);
create index expense_subcategories_user_idx on public.expense_subcategories(user_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "Users manage own events" on public.events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index events_user_idx on public.events(user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  category_id uuid references public.expense_categories(id) on delete set null,
  subcategory_id uuid references public.expense_subcategories(id) on delete set null,
  income_source_id uuid references public.income_categories(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  from_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  transfer_purpose text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_accounts_differ check (type <> 'transfer' or from_account_id is distinct from to_account_id)
);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "Users manage own transactions" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index transactions_user_type_idx on public.transactions(user_id, type);
create index transactions_category_idx on public.transactions(category_id);
create index transactions_event_idx on public.transactions(event_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2000 and 2100),
  category_id uuid not null references public.expense_categories(id) on delete cascade,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month, category_id)
);
grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;
alter table public.budgets enable row level security;
create policy "Users manage own budgets" on public.budgets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index budgets_user_month_idx on public.budgets(user_id, year, month);

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger update_accounts_updated_at before update on public.accounts for each row execute function public.update_updated_at_column();
create trigger update_budgets_updated_at before update on public.budgets for each row execute function public.update_updated_at_column();

create or replace function public.validate_transaction()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if new.type = 'income' then
    if new.account_id is null then raise exception 'Income requires a receiving account'; end if;
    if new.income_source_id is null then raise exception 'Income requires an income source'; end if;
    new.from_account_id := null;
    new.to_account_id := null;
    new.category_id := null;
    new.subcategory_id := null;
  elsif new.type = 'expense' then
    if new.account_id is null then raise exception 'Expense requires a payment account'; end if;
    if new.category_id is null then raise exception 'Expense requires a category'; end if;
    new.from_account_id := null;
    new.to_account_id := null;
    new.income_source_id := null;
  elsif new.type = 'transfer' then
    if new.from_account_id is null or new.to_account_id is null then
      raise exception 'Transfer requires both a From and a To account';
    end if;
    if new.from_account_id = new.to_account_id then
      raise exception 'From and To accounts must be different';
    end if;
    new.account_id := null;
    new.category_id := null;
    new.subcategory_id := null;
    new.income_source_id := null;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger validate_transaction before insert or update on public.transactions for each row execute function public.validate_transaction();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

  insert into public.accounts (user_id, name, type) values (new.id, 'Cash', 'cash') returning id into v_cash;
  insert into public.accounts (user_id, name, type) values (new.id, 'My bKash', 'mobile_wallet') returning id into v_bkash;
  insert into public.accounts (user_id, name, type) values (new.id, 'My Bank', 'bank') returning id into v_bank;
  insert into public.accounts (user_id, name, type) values (new.id, 'Wife''s Account', 'other') returning id into v_wife;

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

  -- Current month demo income
  insert into public.transactions (user_id, type, amount, transaction_date, income_source_id, account_id, note) values
    (new.id, 'income', 25000, m + 1, v_salary, v_bank, 'Monthly salary'),
    (new.id, 'income', 3000, m + 5, v_allowance, v_cash, 'Monthly pocket money from home'),
    (new.id, 'income', 2000, m + 10, v_freelance, v_bkash, 'Freelance project payment');

  -- Current month demo expenses
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

  -- Current month demo transfers (savings, not expenses)
  insert into public.transactions (user_id, type, amount, transaction_date, from_account_id, to_account_id, transfer_purpose, note) values
    (new.id, 'transfer', 5000, m + 4, v_cash, v_bkash, 'Personal Savings', 'Saving in My bKash'),
    (new.id, 'transfer', 5000, m + 7, v_cash, v_wife, 'Family Savings', 'Saving in Wife''s Account');

  -- Current month demo budget
  insert into public.budgets (user_id, year, month, category_id, amount) values
    (new.id, extract(year from m)::int, extract(month from m)::int, v_food, 5000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_transport, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_shopping, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_education, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_ent, 1500),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_personal, 2000),
    (new.id, extract(year from m)::int, extract(month from m)::int, v_other, 1000);

  -- Previous month demo data (for monthly comparison)
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
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();