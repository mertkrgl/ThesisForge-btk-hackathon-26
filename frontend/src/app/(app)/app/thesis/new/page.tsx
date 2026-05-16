"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldAlert, Sparkles, Building2 } from "lucide-react";

export default function NewThesisPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [persona, setPersona] = useState("default");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    
    // Yönlendirme yapıyoruz: Canlı Komite ekranına parametrelerle gidiyoruz
    router.push(`/app/thesis/live?symbol=${symbol.toUpperCase()}&persona=${persona}`);
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
          Yeni Tez Üret
        </h1>
        <p className="mt-3 text-lg text-slate-500 dark:text-slate-400">
          Yapay zeka komitesini toplayın ve saniyeler içinde kaynaklı yatırım tezi alın.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Ticker Input */}
          <div>
            <label htmlFor="symbol" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Hisse Senedi Sembolü
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                name="symbol"
                id="symbol"
                required
                className="block w-full pl-10 pr-12 py-3 sm:text-lg border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl focus:ring-blue-500 focus:border-blue-500 uppercase placeholder:normal-case"
                placeholder="Örn: ASELS"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 sm:text-sm">BIST</span>
              </div>
            </div>
          </div>

          {/* Persona Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
              Komite Stratejisi (Persona)
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              
              <div
                className={`relative rounded-xl border p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                  persona === "default"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                    : "border-slate-200 dark:border-slate-700"
                }`}
                onClick={() => setPersona("default")}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-5 w-5 ${persona === "default" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                    <h3 className={`font-semibold ${persona === "default" ? "text-blue-900 dark:text-blue-100" : "text-slate-900 dark:text-white"}`}>Dengeli Analiz</h3>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${persona === "default" ? "border-blue-600" : "border-slate-300"}`}>
                    {persona === "default" && <div className="h-2 w-2 rounded-full bg-blue-600" />}
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Tüm ajanların eşit ağırlıkta olduğu, standart boğa/ayı senaryolarını içeren objektif komite raporu.
                </p>
              </div>

              <div
                className={`relative rounded-xl border p-4 cursor-pointer hover:border-amber-500 transition-colors ${
                  persona === "conservative"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500"
                    : "border-slate-200 dark:border-slate-700"
                }`}
                onClick={() => setPersona("conservative")}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={`h-5 w-5 ${persona === "conservative" ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`} />
                    <h3 className={`font-semibold ${persona === "conservative" ? "text-amber-900 dark:text-amber-100" : "text-slate-900 dark:text-white"}`}>Muhafazakar (Ali Bey)</h3>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${persona === "conservative" ? "border-amber-600" : "border-slate-300"}`}>
                    {persona === "conservative" && <div className="h-2 w-2 rounded-full bg-amber-600" />}
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Risklerin ve "Devil's Advocate" görüşlerinin öne çıktığı, sermaye korumaya odaklı temkinli analiz.
                </p>
              </div>

            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={!symbol.trim()}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Building2 className="w-5 h-5" />
              Komiteyi Topla ve Analize Başla
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
