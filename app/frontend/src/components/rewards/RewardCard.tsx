import { Gift } from "lucide-react";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import type { Reward } from "../../types/reward.types";

export function RewardCard({ reward, onRedeem }: { reward: Reward; onRedeem: (id: string) => void }) {
  return (
    <Card className="market-card">
      <div className="reward-logo">
        <Gift />
      </div>
      <div>
        <h3>
          {reward.partnerId.name} - {reward.name}
        </h3>
        <p>{reward.quantityRemaining ?? 0} left</p>
      </div>
      <Button onClick={() => onRedeem(reward._id)}>{reward.pointsRequired.toLocaleString()}</Button>
    </Card>
  );
}
