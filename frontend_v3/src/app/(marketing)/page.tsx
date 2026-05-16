import { Hero } from "@/components/marketing/Hero";
import { MiniLiveDemo } from "@/components/marketing/MiniLiveDemo";
import { AgentShowcase } from "@/components/marketing/AgentShowcase";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { DataSources } from "@/components/marketing/DataSources";
import { CtaBand } from "@/components/marketing/CtaBand";
import { DisclaimerBlock } from "@/components/shared/DisclaimerBlock";
import { PageTransition } from "@/components/shared/MotionWrappers";

export default function LandingPage() {
  return (
    <PageTransition>
      <Hero demo={<MiniLiveDemo />} />
      <FeatureGrid />
      <AgentShowcase />
      <HowItWorks />
      <DataSources />

      <section className="mx-auto w-full max-w-[1280px] px-6 py-12">
        <DisclaimerBlock />
      </section>

      <CtaBand />
    </PageTransition>
  );
}
