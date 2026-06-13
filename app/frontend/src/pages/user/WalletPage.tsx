import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { MobileShell } from "../../components/layout/MobileShell";
import { VoucherCard } from "../../components/wallet/VoucherCard";
import { getWallet } from "../../services/wallet.api";
import { useAuthStore } from "../../store/authStore";
import type { UserVoucher } from "../../types/voucher.types";

export function WalletPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [wallet, setWallet] = useState<UserVoucher[]>([]);

  useEffect(() => {
    if (token) void getWallet().then(setWallet);
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <MobileShell>
      <PageHeader title="Wallet" />
      <section className="list-stack">
        {wallet.length ? wallet.map((voucher) => <VoucherCard key={voucher._id} voucher={voucher} />) : <p className="message">No vouchers yet.</p>}
      </section>
    </MobileShell>
  );
}
