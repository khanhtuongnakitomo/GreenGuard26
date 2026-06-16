import { Gift, Home, QrCode, Recycle, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/scan", label: "Scan", icon: QrCode },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/impact", label: "Impact", icon: Recycle },
  { to: "/profile", label: "Profile", icon: UserRound }
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} className="nav-item">
            <Icon size={24} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
