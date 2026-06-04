import { Card } from "../common/Card";
import type { User } from "../../types/user.types";

export function PointsSummaryCard({ user, month }: { user: User; month: { bottles: number; cans: number } }) {
  return (
    <Card className="points-card">
      <div className="member-badge">Green Member</div>
      <div className="avatar" />
      <div>
        <h2>{user.displayName}</h2>
        <div className="points-line">
          <strong>{user.totalPoints.toLocaleString()}</strong>
          <span>pts</span>
        </div>
        <p>
          This month: <b>{month.bottles}</b> bottles · <b>{month.cans}</b> cans
        </p>
      </div>
      <div className="eco-world" />
    </Card>
  );
}
