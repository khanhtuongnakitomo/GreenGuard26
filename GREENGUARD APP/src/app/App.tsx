import { useState } from "react";
import {
  Home,
  QrCode,
  Gift,
  User,
  Leaf,
  ChevronRight,
  Star,
  Recycle,
  Zap,
  Bell,
  Settings,
  TrendingUp,
  Award,
  CheckCircle,
  Clock,
  MapPin,
  Camera,
  ArrowUpRight,
  Sparkles,
  TreePine,
  Droplets,
} from "lucide-react";

type Tab = "home" | "map" | "scan" | "rewards" | "profile";

const NAV_TABS: { id: Tab; icon: typeof Home; label: string }[] = [
  { id: "home",    icon: Home,   label: "Home"    },
  { id: "map",     icon: MapPin, label: "Map"     },
  { id: "rewards", icon: Gift,   label: "Rewards" },
  { id: "profile", icon: User,   label: "Profile" },
];

/* ─── Design tokens ─────────────────────────────────────── */
const C = {
  green:      "#1B8A4A",
  greenDark:  "#166534",
  greenLight: "#E7F4EA",
  bg:         "#F7F8F5",
  card:       "#FFFFFF",
  border:     "#D6DDD2",
  text:       "#1F2937",
  textSec:    "#647067",
  warning:    "#F59E0B",
  warningBg:  "#FEF3C7",
  warningBdr: "#FDE68A",
  error:      "#EF4444",
  infoBg:     "#EFF6FF",
  infoBdr:    "#BFDBFE",
  infoText:   "#1D4ED8",
};

const shadow = {
  card:   "0 2px 8px rgba(0,0,0,0.06)",
  cardMd: "0 4px 14px rgba(0,0,0,0.08)",
  btn:    "0 2px 6px rgba(27,138,74,0.22)",
  nav:    "0 2px 10px rgba(0,0,0,0.08)",
};

/* ─── Shared primitives ─────────────────────────────────── */
function Card({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 20,
        boxShadow: shadow.card,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function GreenBtn({
  children,
  onClick,
  className = "",
  small = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        background: C.green,
        color: "#fff",
        border: "none",
        borderRadius: 16,
        fontWeight: 700,
        fontSize: small ? 13 : 15,
        padding: small ? "7px 14px" : "14px 0",
        width: small ? undefined : "100%",
        boxShadow: shadow.btn,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function IconBox({
  icon: Icon,
  bg = C.greenLight,
  color = C.green,
  size = 17,
  boxSize = 38,
  radius = 12,
}: {
  icon: typeof Home;
  bg?: string;
  color?: string;
  size?: number;
  boxSize?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: radius,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={size} style={{ color }} strokeWidth={2} />
    </div>
  );
}

function Badge({
  children,
  variant = "green",
}: {
  children: React.ReactNode;
  variant?: "green" | "warning" | "error" | "blue";
}) {
  const map = {
    green:   { bg: C.greenLight,  color: C.greenDark, border: "#BBF7D0" },
    warning: { bg: C.warningBg,   color: "#92400E",   border: C.warningBdr },
    error:   { bg: "#FEE2E2",     color: "#991B1B",   border: "#FECACA" },
    blue:    { bg: C.infoBg,      color: C.infoText,  border: C.infoBdr },
  };
  const s = map[variant];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1.5px solid ${s.border}`,
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* ─── HOME ──────────────────────────────────────────────── */
function HomeScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 16px 112px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13, color: C.textSec, fontWeight: 500 }}>Good morning,</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>Alex Johnson 👋</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: C.card, border: `1.5px solid ${C.border}`,
              boxShadow: shadow.card,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}
          >
            <Bell size={17} style={{ color: C.green }} strokeWidth={2} />
            <span style={{
              position: "absolute", top: 8, right: 8,
              width: 8, height: 8, borderRadius: "50%",
              background: C.error, border: "2px solid #fff",
            }} />
          </button>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: C.green,
            border: `2px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13, color: "#fff",
          }}>
            AJ
          </div>
        </div>
      </div>

      {/* Hero Card — solid green */}
      <div style={{
        background: C.green,
        border: `1.5px solid ${C.greenDark}`,
        borderRadius: 20,
        boxShadow: "0 4px 16px rgba(27,138,74,0.28)",
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative circle */}
        <div style={{
          position: "absolute", top: -28, right: -28,
          width: 110, height: 110, borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.18)",
                border: "1.5px solid rgba(255,255,255,0.28)",
                borderRadius: 20, padding: "4px 10px",
                fontSize: 11, fontWeight: 700, color: "#fff",
                marginBottom: 10,
              }}>
                <Sparkles size={11} strokeWidth={2} style={{ color: "#fff" }} />
                GreenGuard Member
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500, marginBottom: 2 }}>Total Green Points</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1 }}>2,847</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 3 }}>pts</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>
                <TrendingUp size={12} strokeWidth={2} />
                +124 this week
              </div>
            </div>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "rgba(255,255,255,0.18)",
              border: "1.5px solid rgba(255,255,255,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TreePine size={26} style={{ color: "#fff" }} strokeWidth={2} />
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            background: "rgba(255,255,255,0.14)",
            border: "1.5px solid rgba(255,255,255,0.22)",
            borderRadius: 14, padding: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>Progress to Gold</span>
              <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>2,847 / 3,500</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 8, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
              <div style={{ width: "81%", height: "100%", borderRadius: 8, background: "#fff" }} />
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>653 pts until Gold tier</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { icon: Recycle,   label: "Recycled",    value: "47kg",  bg: C.greenLight, color: C.green   },
          { icon: Droplets,  label: "Water Saved", value: "320L",  bg: C.infoBg,     color: C.infoText },
          { icon: Zap,       label: "CO₂ Offset",  value: "12kg",  bg: C.warningBg,  color: "#D97706"  },
        ].map((s) => (
          <Card key={s.label} style={{ padding: 14 }}>
            <IconBox icon={s.icon} bg={s.bg} color={s.color} size={15} boxSize={34} radius={10} />
            <p style={{ fontSize: 17, fontWeight: 800, color: C.text, marginTop: 8, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: C.textSec, marginTop: 3 }}>{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Scan CTA — solid green, no gradient */}
      <button
        style={{
          width: "100%", borderRadius: 18,
          background: C.green, border: `1.5px solid ${C.greenDark}`,
          boxShadow: shadow.btn,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: "rgba(255,255,255,0.18)",
            border: "1.5px solid rgba(255,255,255,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <QrCode size={22} color="#fff" strokeWidth={2} />
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Scan & Earn Points</p>
            <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 2 }}>Scan recycling bins to earn rewards</p>
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: "rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Camera size={17} color="#fff" strokeWidth={2} />
        </div>
      </button>

      {/* Nearby Bins */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Nearby Bins</h2>
          <button style={{ fontSize: 12, fontWeight: 600, color: C.green, display: "flex", alignItems: "center", gap: 2, background: "none", border: "none" }}>
            View all <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { name: "Central Park Bin A2",   dist: "0.2 km", fill: 68, status: "Active" },
            { name: "Green Ave Recycling",   dist: "0.5 km", fill: 32, status: "Active" },
            { name: "Oak St Station",        dist: "0.8 km", fill: 91, status: "Full"   },
          ].map((bin) => {
            const isFull = bin.status === "Full";
            return (
              <Card key={bin.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                <IconBox
                  icon={Recycle}
                  bg={isFull ? C.warningBg : C.greenLight}
                  color={isFull ? "#D97706" : C.green}
                  size={17} boxSize={40} radius={12}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bin.name}</p>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isFull ? "#D97706" : C.green, marginLeft: 8 }}>{bin.fill}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 6, background: C.border, overflow: "hidden" }}>
                      <div style={{ width: `${bin.fill}%`, height: "100%", borderRadius: 6, background: isFull ? C.warning : C.green }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <MapPin size={11} style={{ color: C.textSec }} strokeWidth={2} />
                      <span style={{ fontSize: 11, color: C.textSec }}>{bin.dist}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={isFull ? "warning" : "green"}>{bin.status}</Badge>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Featured Reward */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Featured Reward</h2>
          <button style={{ fontSize: 12, fontWeight: 600, color: C.green, display: "flex", alignItems: "center", gap: 2, background: "none", border: "none" }}>
            All rewards <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>
        <Card>
          <div style={{ padding: "14px 14px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1.5px solid ${C.border}` }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: C.greenLight, border: `1.5px solid #BBF7D0`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Gift size={24} style={{ color: C.green }} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Eco Coffee Voucher</p>
                <Badge variant="green">HOT</Badge>
              </div>
              <p style={{ fontSize: 12, color: C.textSec }}>Valid at Green Bean Café</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                <Star size={12} fill="#F59E0B" style={{ color: "#F59E0B" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>4.9</span>
                <span style={{ fontSize: 12, color: C.textSec }}>· 2,340 redeemed</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.green }}>500</p>
              <p style={{ fontSize: 11, color: C.textSec }}>pts</p>
            </div>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={13} style={{ color: C.textSec }} strokeWidth={2} />
              <span style={{ fontSize: 12, color: C.textSec }}>Expires in 14 days</span>
            </div>
            <GreenBtn small>Redeem Now</GreenBtn>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 10 }}>Recent Activity</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[
            { icon: Recycle,      label: "Recycled plastic waste",    pts: "+35 pts",  time: "2h ago",     bg: C.greenLight, color: C.green    },
            { icon: CheckCircle,  label: "Checked in at Oak St",      pts: "+20 pts",  time: "Yesterday",  bg: C.infoBg,     color: C.infoText  },
            { icon: Gift,         label: "Redeemed Plant Voucher",    pts: "-300 pts", time: "3 days ago", bg: C.warningBg,  color: "#D97706"   },
          ].map((a) => (
            <Card key={a.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
              <IconBox icon={a.icon} bg={a.bg} color={a.color} size={16} boxSize={36} radius={11} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.label}</p>
                <p style={{ fontSize: 11, color: C.textSec, marginTop: 1 }}>{a.time}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: a.pts.startsWith("-") ? C.error : C.green }}>{a.pts}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── SCAN ──────────────────────────────────────────────── */
function ScanScreen() {
  const [scanned, setScanned] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px 112px" }}>
      <div style={{ width: "100%", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Scan QR Code</h1>
        <p style={{ fontSize: 13, color: C.textSec }}>Point your camera at a recycling bin QR code</p>
      </div>

      {/* Viewfinder */}
      <div style={{
        width: "100%", aspectRatio: "1/1", borderRadius: 24,
        background: "#0F1F0F",
        border: `2px solid ${C.border}`,
        boxShadow: shadow.cardMd,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16,
      }}>
        {/* Corner marks */}
        {([["top-4 left-4", "8px 0 0 0", true, false, false, true],
           ["top-4 right-4","0 8px 0 0", true, true, false, false],
           ["bottom-4 left-4","0 0 0 8px",false, false, true, true],
           ["bottom-4 right-4","0 0 8px 0",false, true, true, false]] as [string,string,...boolean[]][]).map(([pos, rad, bTop, bRight, bBottom, bLeft], i) => (
          <div key={i} style={{
            position: "absolute",
            top: pos.includes("top") ? 16 : undefined,
            bottom: pos.includes("bottom") ? 16 : undefined,
            left: pos.includes("left") ? 16 : undefined,
            right: pos.includes("right") ? 16 : undefined,
            width: 28, height: 28, borderRadius: rad as string,
            borderTop: bTop ? `3px solid #2FB65D` : "none",
            borderRight: bRight ? `3px solid #2FB65D` : "none",
            borderBottom: bBottom ? `3px solid #2FB65D` : "none",
            borderLeft: bLeft ? `3px solid #2FB65D` : "none",
          }} />
        ))}

        <div style={{ textAlign: "center" }}>
          <QrCode size={60} style={{ color: "rgba(47,182,93,0.45)", margin: "0 auto 12px" }} strokeWidth={1.5} />
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Align QR code within frame</p>
        </div>

        <button style={{
          position: "absolute", bottom: 14, right: 14,
          width: 38, height: 38, borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
          border: "1.5px solid rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={16} color="rgba(255,255,255,0.65)" strokeWidth={2} />
        </button>
      </div>

      {!scanned ? (
        <div style={{ width: "100%", marginBottom: 16 }}>
          <GreenBtn onClick={() => setScanned(true)}>Simulate Scan</GreenBtn>
        </div>
      ) : (
        <Card style={{ width: "100%", padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 14,
              background: C.green,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle size={20} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.greenDark }}>Bin Scanned Successfully!</p>
              <p style={{ fontSize: 12, color: C.textSec }}>Central Park Bin A2</p>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: C.green }}>+35</p>
              <p style={{ fontSize: 11, color: C.textSec }}>pts earned</p>
            </div>
          </div>
          <GreenBtn onClick={() => setScanned(false)}>Scan Another</GreenBtn>
        </Card>
      )}

      <div style={{ width: "100%" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 10 }}>Recent Scans</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[
            { name: "Central Park Bin A2",  pts: 35, time: "2h ago"     },
            { name: "Green Ave Recycling",  pts: 20, time: "Yesterday"  },
            { name: "Oak St Station",       pts: 50, time: "3 days ago" },
          ].map((s) => (
            <Card key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
              <IconBox icon={QrCode} bg={C.greenLight} color={C.green} size={15} boxSize={36} radius={11} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name}</p>
                <p style={{ fontSize: 11, color: C.textSec, marginTop: 1 }}>{s.time}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>+{s.pts} pts</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── REWARDS ───────────────────────────────────────────── */
function RewardsScreen() {
  const [activeFilter, setActiveFilter] = useState("All");
  const filters = ["All", "Food", "Shopping", "Travel", "Eco"];

  const rewards = [
    { title: "Eco Coffee Voucher",  partner: "Green Bean Café", pts: 500,  rating: 4.9, tag: "Food",     hot: true,  icon: "☕" },
    { title: "Tote Bag Bundle",     partner: "EcoStore",        pts: 750,  rating: 4.7, tag: "Shopping", hot: false, icon: "🛍" },
    { title: "Plant Sapling Kit",   partner: "GreenThumb",      pts: 300,  rating: 4.8, tag: "Eco",      hot: false, icon: "🌱" },
    { title: "Bike Share Pass",     partner: "CycleCity",       pts: 1200, rating: 4.6, tag: "Travel",   hot: true,  icon: "🚲" },
    { title: "Organic Lunch Box",   partner: "NatureFoods",     pts: 400,  rating: 4.5, tag: "Food",     hot: false, icon: "🥗" },
    { title: "Solar Charger",       partner: "SunTech",         pts: 2000, rating: 4.9, tag: "Eco",      hot: false, icon: "⚡" },
  ];

  const filtered = activeFilter === "All" ? rewards : rewards.filter((r) => r.tag === activeFilter);
  const userPts = 2847;

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "20px 16px 112px" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 2 }}>Rewards</h1>
        <p style={{ fontSize: 13, color: C.textSec }}>Redeem your points for eco-friendly rewards</p>
      </div>

      {/* Points banner — solid, no gradient */}
      <Card style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Available Points</p>
          <p style={{ fontSize: 30, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>2,847</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: C.greenDark, color: "#fff",
            borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 700,
          }}>
            <Award size={13} strokeWidth={2} />
            Silver Tier
          </div>
          <p style={{ fontSize: 11, color: C.textSec, marginTop: 4 }}>653 pts to Gold</p>
        </div>
      </Card>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2, marginBottom: 14 }} className="no-scrollbar">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            style={{
              flexShrink: 0,
              padding: "7px 16px",
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: activeFilter === f ? C.green : C.card,
              color: activeFilter === f ? "#fff" : C.textSec,
              border: activeFilter === f ? `1.5px solid ${C.greenDark}` : `1.5px solid ${C.border}`,
              boxShadow: activeFilter === f ? shadow.btn : "none",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        {filtered.map((r) => {
          const canRedeem = userPts >= r.pts;
          return (
            <Card key={r.title} style={{ overflow: "hidden", borderRadius: 20, display: "flex", flexDirection: "column" }}>
              <div style={{
                height: 96, background: C.greenLight,
                borderBottom: `1.5px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}>
                <span style={{ fontSize: 36 }}>{r.icon}</span>
                {r.hot && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    background: C.error, color: "#fff",
                    borderRadius: 8, fontSize: 10, fontWeight: 700, padding: "2px 7px",
                  }}>HOT</div>
                )}
                <div style={{
                  position: "absolute", top: 8, left: 8,
                  background: C.green, color: "#fff",
                  borderRadius: 8, fontSize: 10, fontWeight: 700, padding: "2px 7px",
                }}>{r.tag}</div>
              </div>
              <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 2 }}>{r.title}</p>
                <p style={{ fontSize: 11, color: C.textSec, marginBottom: 6 }}>{r.partner}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
                  <Star size={11} fill="#F59E0B" style={{ color: "#F59E0B" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#92400E" }}>{r.rating}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{r.pts.toLocaleString()} pts</span>
                  <button style={{
                    padding: "6px 12px",
                    borderRadius: 12,
                    fontSize: 12, fontWeight: 700,
                    background: canRedeem ? C.green : C.bg,
                    color: canRedeem ? "#fff" : C.textSec,
                    border: canRedeem ? "none" : `1.5px solid ${C.border}`,
                    boxShadow: canRedeem ? shadow.btn : "none",
                    cursor: "pointer",
                  }}>
                    {canRedeem ? "Redeem" : "Locked"}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PROFILE ───────────────────────────────────────────── */
function ProfileScreen() {
  const stats = [
    { label: "Total Scans", value: "184", icon: QrCode  },
    { label: "Pts Earned",  value: "4.2K", icon: Leaf   },
    { label: "Rewards",     value: "12",   icon: Gift    },
    { label: "Streak",      value: "14d",  icon: Zap     },
  ];

  const menuItems = [
    { label: "My Activity",     icon: TrendingUp, badge: null      },
    { label: "My Rewards",      icon: Gift,       badge: "3 new"   },
    { label: "Nearby Bins",     icon: MapPin,     badge: null      },
    { label: "Notifications",   icon: Bell,       badge: "5"       },
    { label: "Settings",        icon: Settings,   badge: null      },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "20px 16px 112px" }}>

      {/* Profile hero — solid green, no gradient */}
      <Card style={{
        padding: 20, marginBottom: 16, position: "relative", overflow: "hidden",
        background: C.green, border: `1.5px solid ${C.greenDark}`,
      }}>
        <div style={{
          position: "absolute", top: -20, right: -20,
          width: 90, height: 90, borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            border: "2px solid rgba(255,255,255,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 18, color: "#fff",
          }}>
            AJ
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Alex Johnson</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.70)", marginTop: 1 }}>alex.johnson@email.com</p>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              marginTop: 8, padding: "4px 10px", borderRadius: 20,
              background: "rgba(255,255,255,0.18)",
              border: "1.5px solid rgba(255,255,255,0.25)",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>
              <Award size={12} strokeWidth={2} />
              Silver Member
            </div>
          </div>
          <button style={{
            width: 36, height: 36, borderRadius: 12,
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ArrowUpRight size={17} color="#fff" strokeWidth={2} />
          </button>
        </div>
      </Card>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {stats.map((s) => (
          <Card key={s.label} style={{ padding: "11px 6px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <s.icon size={15} style={{ color: C.green, marginBottom: 5 }} strokeWidth={2} />
            <p style={{ fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 10, color: C.textSec, marginTop: 3, lineHeight: 1.2 }}>{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Menu */}
      <Card style={{ overflow: "hidden" }}>
        {menuItems.map((item, i) => (
          <button key={item.label} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "13px 14px",
            borderBottom: i < menuItems.length - 1 ? `1.5px solid ${C.border}` : "none",
            background: "none", cursor: "pointer",
            textAlign: "left",
          }}>
            <IconBox icon={item.icon} bg={C.greenLight} color={C.green} size={16} boxSize={36} radius={11} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text }}>{item.label}</span>
            {item.badge && <Badge variant="green">{item.badge}</Badge>}
            <ChevronRight size={15} style={{ color: C.textSec }} strokeWidth={2} />
          </button>
        ))}
      </Card>

      {/* Sign Out */}
      <button style={{
        width: "100%", marginTop: 12, padding: "14px 0",
        borderRadius: 16, fontSize: 14, fontWeight: 700,
        background: C.card, border: `1.5px solid ${C.border}`,
        color: C.error, cursor: "pointer",
        boxShadow: shadow.card,
      }}>
        Sign Out
      </button>
    </div>
  );
}

/* ─── MAP ───────────────────────────────────────────────── */
function MapScreen() {
  const bins = [
    { name: "Central Park Bin A2", dist: "0.2 km", fill: 68, status: "Active", x: 52, y: 38 },
    { name: "Green Ave Recycling", dist: "0.5 km", fill: 32, status: "Active", x: 28, y: 58 },
    { name: "Oak St Station",      dist: "0.8 km", fill: 91, status: "Full",   x: 70, y: 62 },
    { name: "River Rd Depot",      dist: "1.1 km", fill: 45, status: "Active", x: 44, y: 74 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "20px 16px 112px" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 2 }}>Nearby Bins</h1>
        <p style={{ fontSize: 13, color: C.textSec }}>Recycling stations near you</p>
      </div>

      {/* Map placeholder */}
      <div style={{
        width: "100%", height: 220, borderRadius: 20,
        background: "#D4E8D0",
        border: `1.5px solid ${C.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        position: "relative", overflow: "hidden",
        marginBottom: 16,
      }}>
        {/* Grid lines */}
        {[25, 50, 75].map(p => (
          <div key={p}>
            <div style={{ position: "absolute", top: `${p}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.5)" }} />
            <div style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.5)" }} />
          </div>
        ))}
        {/* Road simulation */}
        <div style={{ position: "absolute", top: "45%", left: 0, right: 0, height: 10, background: "rgba(255,255,255,0.6)", borderRadius: 4 }} />
        <div style={{ position: "absolute", left: "40%", top: 0, bottom: 0, width: 10, background: "rgba(255,255,255,0.6)", borderRadius: 4 }} />
        {/* Bin markers */}
        {bins.map((b) => (
          <div key={b.name} style={{
            position: "absolute",
            left: `${b.x}%`, top: `${b.y}%`,
            transform: "translate(-50%, -50%)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: b.status === "Full" ? C.warning : C.green,
              border: "2.5px solid #fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Recycle size={13} color="#fff" strokeWidth={2.5} />
            </div>
          </div>
        ))}
        {/* You are here */}
        <div style={{ position: "absolute", left: "50%", top: "48%", transform: "translate(-50%,-50%)" }}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "#2563EB", border: "3px solid #fff",
            boxShadow: "0 0 0 5px rgba(37,99,235,0.20)",
          }} />
        </div>
        <div style={{
          position: "absolute", bottom: 10, right: 10,
          background: C.card, border: `1.5px solid ${C.border}`,
          borderRadius: 10, padding: "4px 10px",
          fontSize: 11, fontWeight: 600, color: C.textSec,
          boxShadow: shadow.card,
        }}>
          📍 Your location
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bins.map((bin) => {
          const isFull = bin.status === "Full";
          return (
            <Card key={bin.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
              <IconBox icon={Recycle} bg={isFull ? C.warningBg : C.greenLight} color={isFull ? "#D97706" : C.green} size={17} boxSize={40} radius={12} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{bin.name}</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isFull ? "#D97706" : C.green, marginLeft: 8 }}>{bin.fill}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 6, background: C.border, overflow: "hidden" }}>
                    <div style={{ width: `${bin.fill}%`, height: "100%", borderRadius: 6, background: isFull ? C.warning : C.green }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} style={{ color: C.textSec }} strokeWidth={2} />
                    <span style={{ fontSize: 11, color: C.textSec }}>{bin.dist}</span>
                  </div>
                </div>
              </div>
              <Badge variant={isFull ? "warning" : "green"}>{bin.status}</Badge>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─── APP SHELL ─────────────────────────────────────────── */
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");

  const screens: Record<Tab, JSX.Element> = {
    home:    <HomeScreen />,
    map:     <MapScreen />,
    scan:    <ScanScreen />,
    rewards: <RewardsScreen />,
    profile: <ProfileScreen />,
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", width: "100%",
      background: "#DDE5DB",
    }}>
      {/* Phone shell */}
      <div style={{
        position: "relative", display: "flex", flexDirection: "column",
        width: 390, height: 844,
        background: C.bg,
        borderRadius: 48,
        boxShadow: "0 40px 90px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.07), inset 0 0 0 1px rgba(255,255,255,0.14)",
        overflow: "hidden",
      }}>

        {/* Status bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 24px 6px",
          background: C.bg,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>9:41</span>
          <div style={{ width: 112, height: 20, borderRadius: 20, background: C.text }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {/* Signal bars */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 12 }}>
              {[4, 6, 8, 10, 12].map((h, i) => (
                <div key={i} style={{
                  width: 3, height: h, borderRadius: 2,
                  background: i < 4 ? C.text : C.border,
                }} />
              ))}
            </div>
            {/* Wifi */}
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
              <path d="M7 8.5C7.8 8.5 8.5 9.2 8.5 10S7.8 11.5 7 11.5 5.5 10.8 5.5 10 6.2 8.5 7 8.5Z" fill={C.text}/>
              <path d="M7 5.5C8.7 5.5 10.2 6.2 11.2 7.3L12.3 6.2C11 4.8 9.1 4 7 4S3 4.8 1.7 6.2L2.8 7.3C3.8 6.2 5.3 5.5 7 5.5Z" fill={C.text}/>
              <path d="M7 2.5C9.5 2.5 11.8 3.5 13.4 5.1L14.5 4C12.6 2.1 10 1 7 1S1.4 2.1 -.5 4L.6 5.1C2.2 3.5 4.5 2.5 7 2.5Z" fill={C.text}/>
            </svg>
            {/* Battery */}
            <div style={{
              display: "flex", alignItems: "center",
              border: `1.5px solid ${C.text}`, borderRadius: 4, padding: 2,
            }}>
              <div style={{ width: 20, height: 10, borderRadius: 2, background: C.text }} />
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto" }} className="no-scrollbar">
          {screens[activeTab]}
        </div>

        {/* ── Bottom Navigation ─────────────────────────── */}
        <div style={{
          flexShrink: 0,
          position: "relative",
          background: "#FFFFFF",
          borderTop: `1.5px solid ${C.border}`,
          paddingBottom: 24,
        }}>
          {/* Floating scan FAB */}
          <button
            onClick={() => setActiveTab("scan")}
            style={{
              position: "absolute",
              top: -26,
              left: "50%",
              transform: "translateX(-50%)",
              width: 52, height: 52,
              borderRadius: "50%",
              background: activeTab === "scan" ? C.greenDark : C.green,
              border: "3px solid #FFFFFF",
              boxShadow: "0 4px 18px rgba(27,138,74,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              zIndex: 20,
            }}
          >
            <QrCode size={22} color="#fff" strokeWidth={2} />
          </button>

          {/* Tab items */}
          <div style={{
            display: "flex",
            alignItems: "center",
            height: 58,
            paddingTop: 6,
          }}>
            {/* Left 2 tabs */}
            {NAV_TABS.slice(0, 2).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 3,
                    height: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <tab.icon
                    size={20}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ color: isActive ? C.green : "#8FA98F" }}
                  />
                  <span style={{
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? C.green : "#8FA98F",
                    lineHeight: 1,
                  }}>
                    {tab.label}
                  </span>
                </button>
              );
            })}

            {/* Center gap for FAB */}
            <div style={{ width: 64, flexShrink: 0 }} />

            {/* Right 2 tabs */}
            {NAV_TABS.slice(2).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 3,
                    height: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <tab.icon
                    size={20}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ color: isActive ? C.green : "#8FA98F" }}
                  />
                  <span style={{
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? C.green : "#8FA98F",
                    lineHeight: 1,
                  }}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
