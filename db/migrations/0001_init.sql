CREATE TABLE IF NOT EXISTS leases (
  lease_id     TEXT PRIMARY KEY,
  protocol_version TEXT NOT NULL,
  workload_id  TEXT NOT NULL,
  offer_id     TEXT NOT NULL,
  provider_id  TEXT NOT NULL,
  state        TEXT NOT NULL,
  issued_at    TIMESTAMPTZ NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempt      INTEGER NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leases_workload_id_idx ON leases (workload_id);

CREATE TABLE IF NOT EXISTS meters (
  meter_id       TEXT PRIMARY KEY,
  protocol_version TEXT NOT NULL,
  workload_id    TEXT NOT NULL,
  lease_id       TEXT NOT NULL,
  provider_id    TEXT NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL,
  completed_at   TIMESTAMPTZ NOT NULL,
  duration_ms    INTEGER NOT NULL,
  input_tokens   INTEGER NOT NULL,
  output_tokens  INTEGER NOT NULL,
  price_eur      NUMERIC NOT NULL,
  outcome        TEXT NOT NULL,
  metadata       JSONB NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meters_workload_id_idx ON meters (workload_id);
