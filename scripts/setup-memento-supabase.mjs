import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = "memento-drawings";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DB_URL;

if (!url || !serviceRoleKey || !databaseUrl) {
  console.error(`
Missing env vars in .env.local:

  SUPABASE_URL              → Project Settings → API → Project URL
  SUPABASE_SERVICE_ROLE_KEY → Project Settings → API → service_role (secret)
  SUPABASE_DB_URL           → Project Settings → Database → Connection string → URI

Then run: npm run setup:memento
`);
  process.exit(1);
}

const sqlPath = path.join(__dirname, "..", "supabase", "memento.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pgClient = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log("Creating memento_entries table…");
  await pgClient.connect();
  await pgClient.query(sql);
  await pgClient.end();
  console.log("Table ready.");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = buckets?.some((bucket) => bucket.name === BUCKET);
  if (exists) {
    console.log(`Storage bucket "${BUCKET}" already exists.`);
    const { error: updateError } = await supabase.storage.updateBucket(BUCKET, {
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (updateError) throw updateError;
    console.log("Bucket mime types updated (png, jpeg, webp).");
  } else {
    console.log(`Creating storage bucket "${BUCKET}"…`);
    const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (bucketError) throw bucketError;
    console.log("Bucket ready.");
  }

  console.log("\nAll set. Test at http://localhost:3000/memento");
} catch (error) {
  console.error("\nSetup failed:", error);
  process.exit(1);
}
