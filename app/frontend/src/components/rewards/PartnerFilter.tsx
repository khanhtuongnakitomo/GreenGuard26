import { Button } from "../common/Button";

export function PartnerFilter({
  partners,
  active,
  onChange
}: {
  partners: string[];
  active: string;
  onChange: (partner: string) => void;
}) {
  return (
    <div className="filter-row">
      {partners.map((partner) => (
        <Button key={partner} variant={active === partner ? "primary" : "secondary"} onClick={() => onChange(partner)}>
          {partner === "all" ? "All" : partner}
        </Button>
      ))}
    </div>
  );
}
