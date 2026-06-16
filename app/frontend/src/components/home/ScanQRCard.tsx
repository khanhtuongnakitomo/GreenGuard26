import { ChevronRight, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ScanQRCard() {
  const navigate = useNavigate();
  return (
    <button className="scan-card" onClick={() => navigate("/scan")}>
      <span className="qr-circle">
        <QrCode />
      </span>
      <span>
        <strong>Scan QR</strong>
        <small>to claim points</small>
      </span>
      <ChevronRight />
    </button>
  );
}
