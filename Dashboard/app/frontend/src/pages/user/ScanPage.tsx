import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { PageHeader } from "../../components/layout/PageHeader";
import { MobileShell } from "../../components/layout/MobileShell";
import { ClaimResultModal } from "../../components/scan/ClaimResultModal";
import { QRScanner } from "../../components/scan/QRScanner";
import { claimContribution, createContributionSession } from "../../services/contribution.api";
import { useAuthStore } from "../../store/authStore";

export function ScanPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [claimToken, setClaimToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  async function createDemoQr() {
    try {
      const response = await createContributionSession("DHBK-H1", "machine-demo-key", [
        { itemType: "plastic_bottle", quantity: 3 },
        { itemType: "can", quantity: 1 }
      ]);
      setClaimToken(response.claimToken);
      setMessage(`Machine QR created for ${response.session.totalPoints} points.`);
      setError(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create QR");
      setError(true);
    }
  }

  async function claim() {
    try {
      const response = await claimContribution(claimToken);
      setMessage(`Claimed ${response.transaction.points} points.`);
      setError(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Claim failed");
      setError(true);
    }
  }

  return (
    <MobileShell>
      <PageHeader title="Scan QR" />
      <QRScanner />
      <div className="field-row">
        <input value={claimToken} onChange={(event) => setClaimToken(event.target.value)} placeholder="Claim token" />
        <Button onClick={claim}>Claim</Button>
      </div>
      <Button variant="secondary" onClick={createDemoQr}>Create demo machine QR</Button>
      <ClaimResultModal message={message} error={error} />
    </MobileShell>
  );
}
