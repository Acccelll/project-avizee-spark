// Edge function: export-database-csv
//
// Admin-only export of the entire `public` schema as a ZIP archive containing:
//  - one `<table>.csv` per table with all rows
//  - `_schema.csv` describing every column (table, column, type, nullable, default)
//
// Auth: requires a valid JWT whose user has the `admin` role in `user_roles`.
// Uses the service-role client to read across all RLS-protected tables.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "object") {
    try { str = JSON.stringify(value); } catch { str = String(value); }
  } else {
    str = String(value);
  }
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(csvEscape).join(";");
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(";"));
  return [header, ...lines].join("\n");
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), { methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Validate caller and check admin role
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr || !roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // List public tables + columns via information_schema RPC fallback.
    // information_schema is not exposed by PostgREST by default, so we use
    // a lightweight RPC if available; otherwise we query pg_catalog through
    // a `from()` over a security-definer view. Here we rely on a generic
    // approach: call rpc('public_schema_inventory') if it exists, otherwise
    // fall back to querying `pg_tables` via the REST API is not possible —
    // instead we use the admin client's PostgREST endpoint with a custom
    // `from('pg_tables')` which IS exposed in the `pg_catalog`-derived
    // `pg_tables` view on Supabase.
    //
    // Simplest reliable path: query the REST endpoint `/rest/v1/?` — not
    // available. So we issue a direct SQL via the Postgres meta endpoint
    // using the admin client's `rpc` on a known helper.
    //
    // Implementation: define inline a tiny RPC call to a function that
    // returns table/column info. We expect `public.list_public_schema()`
    // to exist (created in the migration shipped with this function).

    type ColumnInfo = {
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      ordinal_position: number;
    };

    const { data: schemaRows, error: schemaErr } = await admin.rpc("list_public_schema");
    if (schemaErr) {
      return new Response(JSON.stringify({ error: "Failed to list schema", details: schemaErr.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const columns = (schemaRows as ColumnInfo[]) ?? [];
    const byTable = new Map<string, ColumnInfo[]>();
    for (const c of columns) {
      if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
      byTable.get(c.table_name)!.push(c);
    }

    const zip = new JSZip();

    // Schema CSV
    const schemaCsv = rowsToCsv(
      columns.map((c) => ({
        table_name: c.table_name,
        column_name: c.column_name,
        data_type: c.data_type,
        is_nullable: c.is_nullable,
        column_default: c.column_default,
        ordinal_position: c.ordinal_position,
      })) as Record<string, unknown>[],
      ["table_name", "ordinal_position", "column_name", "data_type", "is_nullable", "column_default"],
    );
    zip.file("_schema.csv", schemaCsv);

    // Manifest with row counts (filled while we dump)
    const manifest: { table: string; rows: number; error?: string }[] = [];

    // Dump each table in pages of 1000 rows
    const PAGE = 1000;
    for (const [table, cols] of byTable) {
      const colNames = cols
        .sort((a, b) => a.ordinal_position - b.ordinal_position)
        .map((c) => c.column_name);
      const all: Record<string, unknown>[] = [];
      let from = 0;
      let tableError: string | undefined;
      // Cap per table to avoid runaway memory: 200k rows / table
      const HARD_CAP = 200_000;
      while (from < HARD_CAP) {
        const { data, error } = await admin
          .from(table)
          .select("*")
          .range(from, from + PAGE - 1);
        if (error) {
          tableError = error.message;
          break;
        }
        if (!data || data.length === 0) break;
        all.push(...(data as Record<string, unknown>[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const csv = rowsToCsv(all, colNames);
      zip.file(`${table}.csv`, csv);
      manifest.push({ table, rows: all.length, error: tableError });
    }

    zip.file("_manifest.json", JSON.stringify({
      generated_at: new Date().toISOString(),
      generated_by: userData.user.email ?? userData.user.id,
      tables: manifest,
    }, null, 2));

    const blob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const filename = `avizee_db_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;

    return new Response(blob, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Internal error", details: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});