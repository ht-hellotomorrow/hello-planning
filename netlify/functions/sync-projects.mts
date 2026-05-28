import type { Config } from "@netlify/functions";

export default async () => {
  const url = process.env.URL ?? process.env.DEPLOY_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!url) {
    return new Response(
      JSON.stringify({ error: "URL env var missing" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  if (!cronSecret) {
    return new Response(
      JSON.stringify({ error: "CRON_SECRET missing" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const res = await fetch(`${url}/api/sync`, {
    method: "POST",
    headers: { "x-cron-secret": cronSecret },
  });

  const body = await res.text();
  console.log("[scheduled sync]", res.status, body);

  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  schedule: "*/30 * * * *",
};
