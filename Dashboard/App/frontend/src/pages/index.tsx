import HeroSection from "../components/section/HeroSection";
import ProblemSection from "../components/section/ProblemSection";
import WorkflowSection from "../components/section/WorkflowSection";
import TechStackSection from "../components/section/TechStackSection";
import ArchitectureSection from "../components/section/ArchitectureSection";
import ImpactSection from "../components/section/ImpactSection";
import DeploymentRoadmapSection from "../components/section/DeploymentRoadmapSection";

export default function Index() {
  return (
    <main className="overflow-hidden">
      <HeroSection />
      <ProblemSection />
      <WorkflowSection />
      <TechStackSection />
      <ArchitectureSection />
      <ImpactSection />
      <DeploymentRoadmapSection />
    </main>
  );
}