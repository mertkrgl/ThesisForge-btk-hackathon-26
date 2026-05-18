import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { MobileTabBar } from "@/components/shell/MobileTabBar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <Topbar />
        {/* pb-20 — mobil alt tab bar için boşluk; md+ üzerinde tab bar gizli */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
