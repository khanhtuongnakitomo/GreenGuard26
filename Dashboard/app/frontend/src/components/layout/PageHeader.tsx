import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PageHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      <button className="round-button" onClick={() => navigate(-1)} aria-label="Back">
        <ChevronLeft />
      </button>
      <h2>{title}</h2>
    </header>
  );
}
