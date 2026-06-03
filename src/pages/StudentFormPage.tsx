import { useEffect, useState } from "react";
import {
  loadRegisterOptions,
  login,
  register,
  type RegisterEducationFormOption,
  type RegisterGroupOption,
} from "../api/appApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import type { User } from "../types/student";

type AuthSession = {
  user: User;
  token: string;
};

type StudentFormPageProps = {
  onAuth: (session: AuthSession) => void;
};

export function StudentFormPage({ onAuth }: StudentFormPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginValue, setLoginValue] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [admissionYear, setAdmissionYear] = useState(new Date().getFullYear());
  const [educationFormId, setEducationFormId] = useState(0);
  const [groupId, setGroupId] = useState(0);
  const [groups, setGroups] = useState<RegisterGroupOption[]>([]);
  const [educationForms, setEducationForms] = useState<RegisterEducationFormOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRegisterOptions()
      .then((options) => {
        setGroups(options.groups);
        setEducationForms(options.educationForms);
        setGroupId(options.groups[0]?.id || 0);
        setEducationFormId(options.educationForms[0]?.id || 0);
      })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError)));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      if (mode === "login") {
        onAuth(await login(loginValue, password));
      } else {
        onAuth(
          await register({
            login: loginValue,
            password,
            lastName,
            firstName,
            middleName,
            admissionYear,
            educationFormId,
            groupId,
          })
        );
      }
    } catch (authError) {
      setError(getErrorMessage(authError));
    }
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    if (nextMode === "login") {
      setLoginValue("admin");
      setPassword("admin");
    } else {
      setLoginValue("");
      setPassword("");
      setLastName("");
      setFirstName("");
      setMiddleName("");
      setAdmissionYear(new Date().getFullYear());
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>{mode === "login" ? "Вход в систему" : "Регистрация студента"}</h1>

        <div className="auth-tabs">
          <Button type="button" variant={mode === "login" ? "primary" : "secondary"} onClick={() => switchMode("login")}>
            Вход
          </Button>
          <Button type="button" variant={mode === "register" ? "primary" : "secondary"} onClick={() => switchMode("register")}>
            Регистрация
          </Button>
        </div>

        {mode === "login" ? (
          <p>
            Доступны пользователи <b>admin / admin</b> и <b>user / user</b>.
          </p>
        ) : (
          <p>После регистрации будет создана запись студента, связанная с вашим аккаунтом.</p>
        )}

        {error && <div className="notice">{error}</div>}

        <Input placeholder="Логин" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} />
        <Input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {mode === "register" && (
          <>
            <Input placeholder="Фамилия" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            <Input placeholder="Имя" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <Input placeholder="Отчество" value={middleName} onChange={(event) => setMiddleName(event.target.value)} />
            <Input
              type="number"
              placeholder="Год поступления"
              value={admissionYear}
              onChange={(event) => setAdmissionYear(Number(event.target.value))}
            />
            <Select value={educationFormId} onChange={(event) => setEducationFormId(Number(event.target.value))}>
              {educationForms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </Select>
            <Select value={groupId} onChange={(event) => setGroupId(Number(event.target.value))}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} - {group.specialityName}
                </option>
              ))}
            </Select>
          </>
        )}

        <Button type="submit">{mode === "login" ? "Войти" : "Зарегистрироваться"}</Button>
      </form>
    </div>
  );
}
