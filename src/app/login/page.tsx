"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push(from);
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ht-logo.png"
          alt="Hello Tomorrow"
          width={64}
          height={64}
          className="w-16 h-16 rounded-2xl object-cover mb-3 mx-auto"
        />
        <h1 className="text-2xl font-bold tracking-tight">Hello Planning</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sign in with the company password
        </p>
      </div>
      <label className="block text-sm">
        <span className="block text-muted-foreground mb-1.5">Password</span>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition"
      >
        {loading ? "..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
