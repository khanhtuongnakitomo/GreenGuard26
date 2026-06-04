import type { ReactNode } from "react";
import { Card } from "../common/Card";

export function ImpactStatCard({
  label,
  value,
  unit,
  icon
}: {
  label: string;
  value: number;
  unit: string;
  icon: ReactNode;
}) {
  return (
    <Card className="impact-stat">
      <small>{label}</small>
      <strong>{value.toLocaleString()}</strong>
      <span>{unit}</span>
      <div>{icon}</div>
    </Card>
  );
}
