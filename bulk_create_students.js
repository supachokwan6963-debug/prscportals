/**
 * bulk_create_students.js
 *
 * Reads the student roster directly from the `students` table in Supabase
 * (no local CSV needed) and, for every row that doesn't already have an
 * Auth account:
 *   1. Creates a Supabase Auth user  -> email: {student_id}@piriyalai.net
 *                                        password: DEFAULT_PASSWORD (default "12345")
 *
 * Safe to re-run: students who already have an account are skipped, not duplicated.
 *
 * SETUP
 *   1. npm install
 *   2. Create a file named .env next to this script:
 *        SUPABASE_URL=https://dkuyxaujvhqanloqcgbh.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrdXl4YXVqdmhxYW5sb3FjZ2JoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI4ODc5NywiZXhwIjoyMDk5ODY0Nzk3fQ.JelAnSnhzoLRIUolO2rKLHWn8YNjUBOYPU4thrw-670
 *        DEFAULT_PASSWORD=12345
 *      NEVER commit .env or the service role key anywhere public.
 *   3. Run:  node bulk_create_students.js
 *
 * The script prints progress as it goes and writes a full result log to
 * bulk_create_results.csv (student_id, status, message) when it finishes.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || "12345";
const DELAY_MS = Number(process.env.DELAY_MS || 300); // pause between requests to avoid rate limits
const PAGE_SIZE = 1000; // Supabase's default max rows per query
const EMAIL_DOMAIN = "piriyalai.net";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — see the setup notes at the top of this file.");
  process.exit(1);
}

// service_role key = full admin access, bypasses RLS. Server-side use only.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllStudents() {
  let all = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("students")
      .select("student_id, fullname, grade, room, class_no")
      .order("student_id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  return all;
}

async function main() {
  console.log("Fetching student roster from Supabase...");
  const rows = await fetchAllStudents();
  console.log(`Loaded ${rows.length} students from the students table.`);
  console.log(`Default password for new accounts: ${DEFAULT_PASSWORD}`);
  console.log("Starting...\n");

  const results = [];
  let created = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const studentId = String(row.student_id).trim();
    const fullname = String(row.fullname).trim();
    const email = `${studentId}@${EMAIL_DOMAIN}`;

    process.stdout.write(`[${i + 1}/${rows.length}] ${studentId} ${fullname} ... `);

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true, // no confirmation email needed for these dummy addresses
        user_metadata: {
          student_id: studentId,
          fullname,
          grade: row.grade,
          room: row.room,
          class_no: row.class_no,
        },
      });

      if (authError) {
        // Already exists -> not a failure, just skip
        if (String(authError.message).toLowerCase().includes("already") || authError.status === 422) {
          skipped++;
          console.log("SKIPPED (account already exists)");
          results.push({ student_id: studentId, status: "already_existed", message: "" });
        } else {
          throw authError;
        }
      } else {
        created++;
        console.log("OK (account created)");
        results.push({ student_id: studentId, status: "created", message: "" });
      }
    } catch (err) {
      failed++;
      const msg = err?.message || String(err);
      console.log(`FAILED (${msg})`);
      results.push({ student_id: studentId, status: "failed", message: msg });
    }

    await sleep(DELAY_MS);
  }

  const logPath = path.join(__dirname, "bulk_create_results.csv");
  const header = "student_id,status,message\n";
  const body = results
    .map((r) => `${r.student_id},${r.status},"${(r.message || "").replace(/"/g, '""')}"`)
    .join("\n");
  fs.writeFileSync(logPath, header + body, "utf8");

  console.log("\n=== DONE ===");
  console.log(`Created:        ${created}`);
  console.log(`Already existed: ${skipped}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Full log written to: ${logPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
