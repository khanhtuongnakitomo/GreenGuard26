import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { PageHeader } from "../../components/layout/PageHeader";
import { MobileShell } from "../../components/layout/MobileShell";
import { getAdminOverview } from "../../services/admin.api";
import { useAuthStore } from "../../store/authStore";

export function AdminOverviewPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [overview, setOverview] = useState<any>();

  useEffect(() => {
    if (token) void getAdminOverview().then(setOverview);
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <MobileShell>
      <PageHeader title="Admin" />
      <section className="admin-grid">
        {overview &&
          ["users", "machines", "partners", "rewards", "vouchersIssued", "sessions", "campaigns"].map((key) => (
            <Card className="metric-card" key={key}>
              <span>{key}</span>
              <strong>{overview[key]}</strong>
            </Card>
          ))}
      </section>
    </MobileShell>
  );
}
