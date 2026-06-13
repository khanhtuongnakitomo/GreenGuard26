import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { login } from "../../services/auth.api";
import { useAuthStore } from "../../store/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [phoneNumber, setPhoneNumber] = useState("0900000001");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const session = await login(phoneNumber, password);
      setSession(session.user, session.accessToken);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="login-page">
      <Card className="login-card">
        <div className="brand login-brand">
          <div className="leaf-logo" />
          <h1>GreenPoint</h1>
        </div>
        <form onSubmit={onSubmit}>
          <label>
            Phone
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <Button type="submit">Login</Button>
        </form>
        {error && <p className="message error">{error}</p>}
        <p className="muted">Demo: Minh user is prefilled. Operator: 0900000002. Admin: 0900000003.</p>
      </Card>
    </main>
  );
}
