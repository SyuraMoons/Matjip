import Image from "next/image";
import WalletClientLoader from "./wallet-client-loader";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-black/10 pb-5">
          <div className="flex items-center gap-3">
            <Image src="/globe.svg" alt="" width={28} height={28} priority />
            <span className="text-xl font-semibold">Matjip</span>
          </div>
          <WalletClientLoader />
        </header>

        <section className="flex flex-1 py-16">
          <div className="w-full">
            <div className="max-w-2xl">

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
