-- 001_init: core schema for HQ menu, outlet assignments, stock, receipts and sales.
-- Conventions: plural snake_case tables, BIGINT identity PKs, explicit constraint names
-- (so errors and tests can refer to them), ON DELETE RESTRICT unless stated otherwise.

-- Keeps updated_at correct even if an UPDATE statement forgets to set it.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- outlets
-- ---------------------------------------------------------------------------
CREATE TABLE outlets (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  code       TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  address    TEXT        NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT outlets_pkey PRIMARY KEY (id),
  -- Business identifier used by HQ; its unique index also serves lookups by code.
  CONSTRAINT outlets_code_key UNIQUE (code),
  CONSTRAINT outlets_code_length CHECK (char_length(code) BETWEEN 2 AND 20),
  CONSTRAINT outlets_name_not_blank CHECK (btrim(name) <> ''),
  -- Optional, but if given it must contain text (NULL = unknown, never '').
  CONSTRAINT outlets_address_not_blank CHECK (address IS NULL OR btrim(address) <> '')
);

-- ---------------------------------------------------------------------------
-- menu_items (HQ master menu)
-- ---------------------------------------------------------------------------
CREATE TABLE menu_items (
  id         BIGINT GENERATED ALWAYS AS IDENTITY,
  sku        TEXT          NOT NULL,
  name       TEXT          NOT NULL,
  category   TEXT          NOT NULL,
  base_price NUMERIC(12,2) NOT NULL,
  is_active  BOOLEAN       NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT menu_items_pkey PRIMARY KEY (id),
  -- Stable business key; its unique index also serves lookups by SKU.
  CONSTRAINT menu_items_sku_key UNIQUE (sku),
  CONSTRAINT menu_items_sku_not_blank CHECK (btrim(sku) <> ''),
  CONSTRAINT menu_items_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT menu_items_category_not_blank CHECK (btrim(category) <> ''),
  CONSTRAINT menu_items_base_price_non_negative CHECK (base_price >= 0)
);

-- ---------------------------------------------------------------------------
-- outlet_menu_items (which HQ items an outlet sells, with optional price override)
-- ---------------------------------------------------------------------------
CREATE TABLE outlet_menu_items (
  id             BIGINT GENERATED ALWAYS AS IDENTITY,
  outlet_id      BIGINT        NOT NULL,
  menu_item_id   BIGINT        NOT NULL,
  price_override NUMERIC(12,2) NULL,
  is_available   BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT outlet_menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT outlet_menu_items_outlet_id_fkey
    FOREIGN KEY (outlet_id) REFERENCES outlets (id) ON DELETE RESTRICT,
  CONSTRAINT outlet_menu_items_menu_item_id_fkey
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE RESTRICT,
  -- One assignment per item per outlet. Leading outlet_id makes this index serve
  -- "load the menu for outlet X" and the outlet_id FK; it is also the target of
  -- inventory's composite FK.
  CONSTRAINT outlet_menu_items_outlet_item_key UNIQUE (outlet_id, menu_item_id),
  CONSTRAINT outlet_menu_items_price_override_non_negative
    CHECK (price_override IS NULL OR price_override >= 0)
);

-- FK on menu_item_id is not the leading column above: needed so deleting/checking a
-- menu item doesn't seq-scan, and for "which outlets sell item X" on the HQ side.
CREATE INDEX outlet_menu_items_menu_item_id_idx ON outlet_menu_items (menu_item_id);

-- ---------------------------------------------------------------------------
-- inventory (stock per outlet per assigned item)
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
  outlet_id    BIGINT      NOT NULL,
  menu_item_id BIGINT      NOT NULL,
  quantity     INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- PK index serves the stock-deduction UPDATE (outlet_id, menu_item_id) and the FK below.
  CONSTRAINT inventory_pkey PRIMARY KEY (outlet_id, menu_item_id),
  -- Stock can only exist for an item that is assigned to that outlet.
  CONSTRAINT inventory_outlet_menu_item_fkey
    FOREIGN KEY (outlet_id, menu_item_id)
    REFERENCES outlet_menu_items (outlet_id, menu_item_id) ON DELETE RESTRICT,
  -- Final guard for "no negative stock", behind the conditional UPDATE in the service.
  CONSTRAINT inventory_quantity_non_negative CHECK (quantity >= 0)
);

-- ---------------------------------------------------------------------------
-- receipt_counters (one row per outlet; row lock serialises receipt numbering)
-- ---------------------------------------------------------------------------
CREATE TABLE receipt_counters (
  outlet_id   BIGINT      NOT NULL,
  last_number BIGINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- PK index: the increment UPDATE targets exactly one row by outlet_id.
  CONSTRAINT receipt_counters_pkey PRIMARY KEY (outlet_id),
  CONSTRAINT receipt_counters_outlet_id_fkey
    FOREIGN KEY (outlet_id) REFERENCES outlets (id) ON DELETE RESTRICT,
  CONSTRAINT receipt_counters_last_number_non_negative CHECK (last_number >= 0)
);

-- ---------------------------------------------------------------------------
-- sales (receipt header)
-- ---------------------------------------------------------------------------
CREATE TABLE sales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY,
  outlet_id      BIGINT        NOT NULL,
  receipt_number BIGINT        NOT NULL,
  total_amount   NUMERIC(12,2) NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_outlet_id_fkey
    FOREIGN KEY (outlet_id) REFERENCES outlets (id) ON DELETE RESTRICT,
  -- Final guard for sequential receipts: a number can never be issued twice per outlet.
  -- Leading outlet_id also makes this index cover the outlet_id FK.
  CONSTRAINT sales_outlet_receipt_number_key UNIQUE (outlet_id, receipt_number),
  CONSTRAINT sales_receipt_number_positive CHECK (receipt_number > 0),
  CONSTRAINT sales_total_amount_non_negative CHECK (total_amount >= 0)
);

-- Per-outlet sales list / outlet reports filtered by date and sorted newest first.
CREATE INDEX sales_outlet_id_created_at_idx ON sales (outlet_id, created_at DESC);
-- HQ reports across all outlets filtered by a date range.
CREATE INDEX sales_created_at_idx ON sales (created_at);

-- ---------------------------------------------------------------------------
-- sale_items (receipt lines; prices copied at sale time)
-- ---------------------------------------------------------------------------
CREATE TABLE sale_items (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  sale_id      BIGINT        NOT NULL,
  menu_item_id BIGINT        NOT NULL,
  quantity     INTEGER       NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL,
  line_total   NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  -- CASCADE (justified): lines have no meaning without their sale; they are one aggregate.
  CONSTRAINT sale_items_sale_id_fkey
    FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
  CONSTRAINT sale_items_menu_item_id_fkey
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE RESTRICT,
  -- Duplicate lines are merged before insert, so one row per item per sale.
  -- Leading sale_id makes this the sale_id index (load lines of a receipt, CASCADE, FK).
  CONSTRAINT sale_items_sale_menu_item_key UNIQUE (sale_id, menu_item_id),
  CONSTRAINT sale_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT sale_items_unit_price_non_negative CHECK (unit_price >= 0),
  -- Guards against arithmetic bugs in application code: exact NUMERIC math.
  CONSTRAINT sale_items_line_total_matches CHECK (line_total = unit_price * quantity)
);

-- menu_item_id FK (RESTRICT checks on menu item delete) and item-level sales reports.
CREATE INDEX sale_items_menu_item_id_idx ON sale_items (menu_item_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER outlets_set_updated_at BEFORE UPDATE ON outlets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER menu_items_set_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER outlet_menu_items_set_updated_at BEFORE UPDATE ON outlet_menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inventory_set_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER receipt_counters_set_updated_at BEFORE UPDATE ON receipt_counters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sales_set_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sale_items_set_updated_at BEFORE UPDATE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
