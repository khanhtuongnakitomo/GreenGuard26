import type { Reward } from "../../types/reward.types";

export function RewardStack({ rewards }: { rewards: Reward[] }) {
  return (
    <div className="reward-stack">
      {rewards.slice(0, 4).map((reward) => (
        <article className="reward-pass" key={reward._id}>
          <span>{reward.partnerId.name.slice(0, 1)}</span>
          <strong>
            {reward.partnerId.name} - {reward.name}
          </strong>
          <b>{reward.pointsRequired >= 1000 ? `${Math.round(reward.pointsRequired / 1000)}k` : reward.pointsRequired}</b>
        </article>
      ))}
    </div>
  );
}
