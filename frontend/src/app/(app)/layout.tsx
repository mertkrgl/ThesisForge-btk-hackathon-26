import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { OnboardingTour } from "@/components/app/OnboardingTour";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <Topbar />
        {/* pb-20 — mobil alt tab bar için boşluk; md+ üzerinde tab bar gizli */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileTabBar />
      <OnboardingTour />
    </div>
  );
}
