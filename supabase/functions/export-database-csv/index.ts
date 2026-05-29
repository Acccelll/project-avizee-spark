// Edge function: export-database-csv
//
// Admin-only export of the entire `public` schema. Supports two formats:
//  - format=csv (default): ZIP with `<table>.csv`, `_schema.csv`, `_manifest.json`
//  - format=sql           : single `.sql` dump with CREATE TABLE + INSERT statements
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

function sqlQuoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown, dataType: string): string {
  if (value === null || value === undefined) return "NULL";
  const t = dataType.toLowerCase();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "object") {
    // jsonb/json/array → store as JSON literal and cast
    const json = JSON.stringify(value).replace(/'/g, "''");
    if (t.includes("json")) return `'${json}'::jsonb`;
    if (t.includes("[]") || t === "array" || t.startsWith("_")) return `'${json}'::jsonb`;
    return `'${json}'`;
  }
  const s = String(value).replace(/'/g, "''");
  return `'${s}'`;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"), { methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Format negotiation: ?format=sql or body { format: "sql" }
    const urlObj = new URL(req.url);
    let format = (urlObj.searchParams.get("format") || "csv").toLowerCase();
    if (req.method === "POST") {
      try {
        const ct = req.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const body = await req.clone().json().catch(() => null);
          if (body && typeof body.format === "string") format = body.format.toLowerCase();
        }
      } catch { /* ignore */ }
    }
    if (format !== "csv" && format !== "sql") format = "csv";

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

    const PAGE = 1000;
    const HARD_CAP = 200_000;

    // ---------------- SQL format ----------------
    if (format === "sql") {
      const parts: string[] = [];
      parts.push(`-- AviZee ERP database export`);
      parts.push(`-- Generated at ${new Date().toISOString()}`);
      parts.push(`-- Generated by ${userData.user.email ?? userData.user.id}`);
      parts.push(`-- Schema: public`);
      parts.push(`SET session_replication_role = 'replica';`);
      parts.push(``);

      for (const [table, cols] of byTable) {
        const ordered = [...cols].sort((a, b) => a.ordinal_position - b.ordinal_position);
        const colNames = ordered.map((c) => c.column_name);
        const colTypes = new Map(ordered.map((c) => [c.column_name, c.data_type]));

        // CREATE TABLE
        const colDefs = ordered.map((c) => {
          const parts2 = [sqlQuoteIdent(c.column_name), c.data_type];
          if (c.column_default) parts2.push(`DEFAULT ${c.column_default}`);
          if (c.is_nullable === "NO") parts2.push("NOT NULL");
          return "  " + parts2.join(" ");
        });
        parts.push(`-- Table: public.${table}`);
        parts.push(`DROP TABLE IF EXISTS public.${sqlQuoteIdent(table)} CASCADE;`);
        parts.push(`CREATE TABLE public.${sqlQuoteIdent(table)} (\n${colDefs.join(",\n")}\n);`);

        // Data
        let from = 0;
        let total = 0;
        while (from < HARD_CAP) {
          const { data, error } = await admin
            .from(table)
            .select("*")
            .range(from, from + PAGE - 1);
          if (error) {
            parts.push(`-- ERROR reading ${table}: ${error.message}`);
            break;
          }
          if (!data || data.length === 0) break;
          const colList = colNames.map(sqlQuoteIdent).join(", ");
          for (const row of data as Record<string, unknown>[]) {
            const vals = colNames.map((n) => sqlLiteral(row[n], colTypes.get(n) || "text")).join(", ");
            parts.push(`INSERT INTO public.${sqlQuoteIdent(table)} (${colList}) VALUES (${vals});`);
          }
          total += data.length;
          if (data.length < PAGE) break;
          from += PAGE;
        }
        parts.push(`-- ${total} row(s) in ${table}`);
        parts.push(``);
      }

      parts.push(`SET session_replication_role = 'origin';`);
      const sql = parts.join("\n");
      const filename = `avizee_db_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`;
      return new Response(sql, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "application/sql; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ---------------- CSV (ZIP) format ----------------
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

    for (const [table, cols] of byTable) {
      const colNames = cols
        .sort((a, b) => a.ordinal_position - b.ordinal_position)
        .map((c) => c.column_name);
      const all: Record<string, unknown>[] = [];
      let from = 0;
      let tableError: string | undefined;
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