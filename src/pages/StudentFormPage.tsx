import { useState } from "react";
import { login } from "../api/appApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import type { User } from "../types/student";

type AuthSession = {
  user: User;
  token: string;
};

type StudentFormPageProps = {
  onAuth: (session: AuthSession) => void;
};

export function StudentFormPage({ onAuth }: StudentFormPageProps) {
  const [loginValue, setLoginValue] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      onAuth(await login(loginValue, password));
    } catch (authError) {
      setError(getErrorMessage(authError));
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Вход в систему</h1>
        <p>
          Демо-учетные записи: <b>admin / admin</b>, <b>staff / staff</b>, <b>teacher / teacher</b>.
        </p>
        {error && <div className="notice">{error}</div>}
        <Input placeholder="Логин" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} />
        <Input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit">Войти</Button>
      </form>
    </div>
  );
}
