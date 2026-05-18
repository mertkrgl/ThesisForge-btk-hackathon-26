import Link from "next/link";


export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-border bg-card/60 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] w-full max-w-[1280px] items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">

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
