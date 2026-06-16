import { Button } from "../common/Button";
import { Card } from "../common/Card";
import type { UserVoucher } from "../../types/voucher.types";

export function VoucherCard({ voucher }: { voucher: UserVoucher }) {
  return (
    <Card className="voucher-card">
      <h3>
        {voucher.rewardId.partnerId.name} - {voucher.rewardId.name}
      </h3>
      <p>{voucher.status} · expires {new Date(voucher.expiresAt).toLocaleDateString()}</p>
      <div className="voucher-code">{voucher.redeemCode}</div>
      <Button variant="secondary">Show QR</Button>
    </Card>
  );
}
