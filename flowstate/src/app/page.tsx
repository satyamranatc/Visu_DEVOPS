import Link from "next/link";
import { topics } from "@/lessons";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 pb-24">
      <header className="flex h-16 items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-teal text-xs font-bold text-white">F</span>
          Flowstate
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Visual infrastructure learning</span>
      </header>

      <main>
        <section className="pt-20 pb-16">
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-tight">
            Don&apos;t read about infrastructure. Watch it work.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Follow a request through a load balancer, push traffic until servers scale out, then break an instance and see how the system recovers.
          </p>
          <Link
            href="/lessons/aws-auto-scaling"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            Open the Auto Scaling simulation
            <span aria-hidden>→</span>
          </Link>
        </section>

        <section aria-labelledby="library">
          <h2 id="library" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Library
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {topics.map((t) => {
              const row = (
                <div className="flex items-center justify-between gap-6 py-5">
                  <div>
                    <p className="text-[15px] font-medium">{t.name}</p>
                    <p className="mt-1 text-sm text-muted">{t.blurb}</p>
                  </div>
                  {t.lesson ? (
                    <span className="shrink-0 rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-teal">5 scenarios · Live</span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">Planned</span>
                  )}
                </div>
              );
              return (
                <li key={t.name}>
                  {t.lesson ? (
                    <Link href={`/lessons/${t.lesson}`} className="block rounded-lg transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-teal">
                      {row}
                    </Link>
                  ) : (
                    <div className="opacity-60">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
