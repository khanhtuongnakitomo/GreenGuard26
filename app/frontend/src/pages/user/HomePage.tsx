import { CalendarDays, CircleDot, Infinity } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ImpactStatCard } from "../../components/home/ImpactStatCard";
import { MilestoneProgressCard } from "../../components/home/MilestoneProgressCard";
import { PointsSummaryCard } from "../../components/home/PointsSummaryCard";
import { RewardStack } from "../../components/home/RewardStack";
import { ScanQRCard } from "../../components/home/ScanQRCard";
import { MobileShell } from "../../components/layout/MobileShell";
import { getMySummary } from "../../services/user.api";
import { getRewards } from "../../services/rewards.api";
import { useAuthStore } from "../../store/authStore";
import type { Reward } from "../../types/reward.types";

export function HomePage() {
  const token = useAuthStore((state) => state.accessToken);
  const [summary, setSummary] = useState<any>();
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    if (!token) return;
    void Promise.all([getMySummary(), getRewards()]).then(([nextSummary, nextRewards]) => {
      setSummary(nextSummary);
      setRewards(nextRewards);
    });
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;
  if (!summary) return <MobileShell><p className="message">Loading GreenPoint</p></MobileShell>;

  return (
    <MobileShell>
      <PointsSummaryCard user={summary.user} month={summary.impact.month} />
      <ScanQRCard />
      <div className="section-title">
        <h2>My Impact</h2>
        <Link to="/impact">View details</Link>
      </div>
      <section className="impact-grid">
        <ImpactStatCard label="Month" value={summary.impact.month.bottles} unit="bottles" icon={<CalendarDays />} />
        <ImpactStatCard label="Cans" value={summary.impact.month.cans} unit="cans" icon={<CircleDot />} />
        <ImpactStatCard label="All time" value={summary.impact.allTime.bottles} unit="bottles" icon={<Infinity />} />
      </section>
      <div className="section-title">
        <h2>Rewards</h2>
        <Link to="/rewards">View all</Link>
      </div>
      <RewardStack rewards={rewards} />
      <MilestoneProgressCard current={summary.impact.month.bottles || 34} target={50} />
    </MobileShell>
  );
}
