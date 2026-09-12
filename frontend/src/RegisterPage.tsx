import { type FormEvent, useState } from "react";
import { Button, Input, Label } from "@heroui/react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { register } from "./api";
import { useAuth } from "./auth";
import { AuthLayout } from "./AuthLayout";
import { FieldHint } from "./components/field-hint";
import { StatusBanner } from "./components/status-banner";

export function RegisterPage() {
  const { loggedIn, completeLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loggedIn) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await register(username, email, password);
      completeLogin(data.token, data);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not register");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Register" subtitle="Create an account in a minute.">
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        {error ? <StatusBanner>{error}</StatusBanner> : null}
        <div className="space-y-2.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            fullWidth
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            fullWidth
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            fullWidth
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FieldHint>At least 8 characters</FieldHint>
        </div>
        <Button type="submit" fullWidth isPending={busy} isDisabled={busy}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-medium text-[var(--accent)] underline-offset-4 hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
