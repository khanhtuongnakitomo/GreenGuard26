import { QrCode } from "lucide-react";

export function QRScanner() {
  return (
    <div className="scanner">
      <div>
        <QrCode size={88} />
      </div>
    </div>
  );
}
