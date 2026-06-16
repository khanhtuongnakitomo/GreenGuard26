import { Link, Navigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { PageHeader } from "../../components/layout/PageHeader";
import { MobileShell } from "../../components/layout/MobileShell";
import { useAuthStore } from "../../store/authStore";

export function ProfilePage() {
  const { user, accessToken, logout } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;

  return (
    <MobileShell>
      <PageHeader title="Profile" />
      <Card className="profile-card">
        <div className="avatar large" />
        <h2>{user?.displayName}</h2>
        <p>{user?.faculty || "GreenPoint"} · {user?.university || "DHBK"}</p>
        <strong>{user?.totalPoints.toLocaleString()} pts</strong>
      </Card>
      <div className="quick-links">
        <Link to="/wallet">Wallet</Link>
        <Link to="/operator">Operator</Link>
        <Link to="/admin">Admin</Link>
      </div>
      <Button variant="secondary" onClick={logout}>Logout</Button>
    </MobileShell>
  );
}
