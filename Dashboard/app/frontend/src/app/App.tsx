import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../pages/auth/LoginPage";
import { AdminOverviewPage } from "../pages/admin/AdminOverviewPage";
import { OperatorPage } from "../pages/operator/OperatorPage";
import { HomePage } from "../pages/user/HomePage";
import { ImpactPage } from "../pages/user/ImpactPage";
import { ProfilePage } from "../pages/user/ProfilePage";
import { RewardsPage } from "../pages/user/RewardsPage";
import { ScanPage } from "../pages/user/ScanPage";
import { WalletPage } from "../pages/user/WalletPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/impact" element={<ImpactPage />} />
      <Route path="/rewards" element={<RewardsPage />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/operator" element={<OperatorPage />} />
      <Route path="/admin" element={<AdminOverviewPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
