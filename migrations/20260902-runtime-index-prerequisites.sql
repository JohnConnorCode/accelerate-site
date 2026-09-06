-- UUID equality operator classes are required by the composite GIN indexes in
-- the coworker/plugin runtime. Install explicitly before those table migrations.
CREATE EXTENSION IF NOT EXISTS btree_gin;
