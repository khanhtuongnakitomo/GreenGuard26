import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card } from "../../components/common/Card";
import { PageHeader } from "../../components/layout/PageHeader";
import { MobileShell } from "../../components/layout/MobileShell";
import { getMyImpact } from "../../services/user.api";
import { useAuthStore } from "../../store/authStore";

export function ImpactPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [impact, setImpact] = useState<any>();

  useEffect(() => {
    if (token) void getMyImpact().then(setImpact);
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <MobileShell>
      <PageHeader title="Impact" />
      {impact && (
        <Card className="impact-detail">
          <h3>{impact.allTime.items.toLocaleString()} recycled items</h3>
          <p>{impact.allTime.bottles.toLocaleString()} bottles</p>
          <p>{impact.allTime.cans.toLocaleString()} cans</p>
          <p>{impact.co2KgEstimate} kg CO2 estimated saved</p>
        </Card>
      )}
    </MobileShell>
  );
}
