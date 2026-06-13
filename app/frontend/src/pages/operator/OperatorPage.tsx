import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { PageHeader } from "../../components/layout/PageHeader";
import { MobileShell } from "../../components/layout/MobileShell";
import { useVoucher, validateVoucher } from "../../services/operator.api";
import { useAuthStore } from "../../store/authStore";

export function OperatorPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [redeemCode, setRedeemCode] = useState("");
  const [message, setMessage] = useState("");

  if (!token) return <Navigate to="/login" replace />;

  async function validate() {
    try {
      const voucher = await validateVoucher(redeemCode);
      setMessage(`Valid voucher: ${voucher.redeemCode}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Validation failed");
    }
  }

  async function markUsed() {
    try {
      const voucher = await useVoucher(redeemCode, "DHBK Partner Counter");
      setMessage(`Voucher ${voucher.redeemCode} marked used.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Use failed");
    }
  }

  return (
    <MobileShell>
      <PageHeader title="Operator" />
      <input value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} placeholder="Voucher code" />
      <div className="field-row">
        <Button variant="secondary" onClick={validate}>Validate</Button>
        <Button onClick={markUsed}>Mark used</Button>
      </div>
      {message && <p className="message">{message}</p>}
    </MobileShell>
  );
}
