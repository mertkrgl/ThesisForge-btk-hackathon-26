import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-border bg-card/60 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] w-full max-w-[1280px] items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[radial-gradient(120%_120%_at_20%_0%,#3B82F6_0%,#1D4ED8_50%,#0B1220_100%)] shadow-[0_6px_20px_-8px_#3B82F6,inset_0_0_0_1px_#2A4D9C]">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight">
              ThesisForge
            </span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-border px-4 py-4 text-center text-[11.5px] text-muted-foreground sm:px-6">
        Üretilen tezler yatırım tavsiyesi değildir · SPK lisanslı değildir
      </footer>
    </div>
  );
}
