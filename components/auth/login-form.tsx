"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAuthTiming, startAuthTiming } from "@/lib/auth/debug";
import { loginSchema } from "@/lib/auth/validation";
import { useAuth } from "@/hooks/use-auth";

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const queryMessage = useMemo(() => {
    const error = searchParams.get("error");

    if (error === "blocked") {
      return "Conta bloqueada. Fale com um administrador.";
    }

    if (error === "profile_missing") {
      return "Conta sem perfil interno. Fale com um administrador.";
    }

    if (error === "pending") {
      return "Conta pendente de aprovacao.";
    }

    if (error === "session_expired") {
      return "Sua sessao expirou. Faca login novamente.";
    }

    if (searchParams.get("password_updated") === "1") {
      return "Senha atualizada. Entre novamente.";
    }

    return null;
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Revise os dados informados.");
      return;
    }

    setIsSubmitting(true);
    const startedAt = startAuthTiming();
    const result = await signIn(parsed.data.email, parsed.data.password);
    logAuthTiming("login signIn", startedAt);
    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    router.replace(safeRedirectPath(searchParams.get("redirectTo")) as Route);
    logAuthTiming("login submit-to-redirect", startedAt);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {(message || queryMessage) ? <div className="auth-alert">{message ?? queryMessage}</div> : null}

      <label className="label" htmlFor="email">
        E-mail
      </label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <label className="label" htmlFor="password">
        Senha
      </label>
      <Input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>

      <Link href="/forgot-password" className="auth-link">
        Esqueci minha senha
      </Link>
    </form>
  );
}
