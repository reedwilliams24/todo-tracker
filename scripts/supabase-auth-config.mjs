#!/usr/bin/env node
// Applies the repo's auth settings (the hosted twin of [auth] in supabase/config.toml) to the hosted
// Supabase projects through the Management API. SMTP fields are never sent, so the Gmail SMTP set up
// in each project's dashboard is kept.
//
//   SUPABASE_ACCESS_TOKEN=… SUPABASE_DEV_PROJECT_REF=… node scripts/supabase-auth-config.mjs dev [--dry-run]
//   pnpm supabase:auth-config dev prod
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../supabase/templates/otp-code.html", import.meta.url), "utf8");
const subject = "Your Todo Tracker code: {{ .Token }}";
const SMTP_FIELDS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_admin_email", "smtp_sender_name"];
const prodUrl = "https://todo-tracker-puce.vercel.app";

const shared = {
  external_email_enabled: true,
  disable_signup: false,
  mailer_otp_length: 6,
  mailer_otp_exp: 600,
  smtp_max_frequency: 60,
  rate_limit_email_sent: 30,
  // Sign-in is email code only: new users get the confirmation email, returning users the magic-link
  // email, and both send just the code.
  mailer_subjects_confirmation: subject,
  mailer_templates_confirmation_content: template,
  mailer_subjects_magic_link: subject,
  mailer_templates_magic_link_content: template,
};

// Vercel previews use dev and production uses prod (REED-63).
const projects = {
  dev: {
    refVar: "SUPABASE_DEV_PROJECT_REF",
    config: {
      ...shared,
      site_url: "http://localhost:3000",
      uri_allow_list: [
        "http://localhost:3000/**",
        "http://127.0.0.1:3000/**",
        "https://todo-tracker-*-reed-williams.vercel.app/**",
      ].join(","),
    },
  },
  prod: {
    refVar: "SUPABASE_PROD_PROJECT_REF",
    config: { ...shared, site_url: prodUrl, uri_allow_list: `${prodUrl}/**` },
  },
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targets = args.filter((a) => a !== "--dry-run");
if (targets.length === 0 || targets.some((t) => !(t in projects))) {
  console.error("usage: supabase-auth-config.mjs <dev|prod>... [--dry-run]");
  process.exit(2);
}
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required");

async function api(ref, method, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} config/auth: ${res.status} ${await res.text()}`);
  return res.json();
}

for (const name of targets) {
  const { refVar, config } = projects[name];
  const ref = process.env[refVar];
  if (!ref) throw new Error(`${refVar} is required`);

  const current = await api(ref, "GET");
  const diff = Object.keys(config).filter((k) => current[k] !== config[k]);
  console.log(`${name}: ${diff.length ? `changing ${diff.join(", ")}` : "already up to date"}`);
  if (dryRun) continue;

  if (diff.length) {
    const after = await api(ref, "PATCH", config);
    const drift = Object.keys(config).filter((k) => after[k] !== config[k]);
    if (drift.length) throw new Error(`${name}: not applied: ${drift.join(", ")}`);
  }
  const final = await api(ref, "GET");
  const smtp = Object.fromEntries(SMTP_FIELDS.map((k) => [k, Boolean(final[k])]));
  console.log(`${name}: SMTP still set:`, smtp);
}
