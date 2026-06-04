import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { PartnerFilter } from "../../components/rewards/PartnerFilter";
import { RewardCard } from "../../components/rewards/RewardCard";
import { PageHeader } from "../../components/layout/PageHeader";
import { MobileShell } from "../../components/layout/MobileShell";
import { getRewards, redeemReward } from "../../services/rewards.api";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import type { Reward } from "../../types/reward.types";

export function RewardsPage() {
  const token = useAuthStore((state) => state.accessToken);
  const active = useUiStore((state) => state.activeRewardPartner);
  const setActive = useUiStore((state) => state.setActiveRewardPartner);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getRewards().then(setRewards);
  }, []);

  const partners = useMemo(() => ["all", ...Array.from(new Set(rewards.map((reward) => reward.partnerId.name)))], [rewards]);
  const visible = active === "all" ? rewards : rewards.filter((reward) => reward.partnerId.name === active);

  if (!token) return <Navigate to="/login" replace />;

  async function redeem(id: string) {
    try {
      const response = await redeemReward(id);
      setMessage(`Voucher ${response.voucher.redeemCode} added to wallet.`);
      setRewards(await getRewards());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Redeem failed");
    }
  }

  return (
    <MobileShell>
      <PageHeader title="Rewards" />
      <PartnerFilter partners={partners} active={active} onChange={setActive} />
      <section className="list-stack">
        {visible.map((reward) => <RewardCard key={reward._id} reward={reward} onRedeem={redeem} />)}
      </section>
      {message && <p className="message">{message}</p>}
    </MobileShell>
  );
}
