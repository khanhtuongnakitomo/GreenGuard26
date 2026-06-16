import { Recycle } from "lucide-react";
import { Card } from "../common/Card";

export function MilestoneProgressCard({ current = 34, target = 50 }: { current?: number; target?: number }) {
  const percent = Math.min(100, Math.round((current / target) * 100));
  return (
    <Card className="milestone-card">
      <div className="medal">★</div>
      <div>
        <h3>Next milestone: {target} bottles</h3>
        <div className="progress">
          <span style={{ width: `${percent}%` }} />
        </div>
        <p>
          <b>{current}</b> / {target} bottles
        </p>
      </div>
      <Recycle />
    </Card>
  );
}
