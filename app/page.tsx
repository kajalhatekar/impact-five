import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Record your scores",
    description:
      "Add your latest five Stableford scores and keep your playing history organised.",
  },
  {
    number: "02",
    title: "Support a charity",
    description:
      "Select a cause and choose how much of your membership contribution supports it.",
  },
  {
    number: "03",
    title: "Enter monthly draws",
    description:
      "Complete your eligibility requirements and participate in the monthly prize draw.",
  },
];

/**
 * Public landing page for the platform.
 *
 * This page introduces the score-tracking, charity-selection and monthly-draw
 * value proposition, then routes visitors either into signup or charity browsing.
 */
export default function Home() {
  return (
    <main className="bg-[#f4f1e9] text-slate-950">
      <section className="mx-auto grid min-h-[calc(100dvh-120px)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-700">
            Play. Give. Change.
          </p>

          <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Your golf scores can create a greater impact.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            Record your latest Stableford scores, support a charity you
            care about, and participate in monthly prize draws through
            one simple membership.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-emerald-700 px-8 py-4 text-center font-semibold text-white transition hover:bg-emerald-800"
            >
              Create your account
            </Link>

            <Link
              href="/charities"
              className="rounded-full border border-slate-300 bg-white px-8 py-4 text-center font-semibold text-slate-900 transition hover:border-emerald-700 hover:text-emerald-700"
            >
              Explore charities
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] bg-emerald-950 p-8 text-white shadow-xl sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">
            Impact Five
          </p>

          <h2 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">
            Five scores. One cause. Monthly opportunities.
          </h2>

          <div className="mt-10 space-y-5">
            {features.map((feature) => (
              <div
                key={feature.number}
                className="rounded-2xl border border-white/15 bg-white/10 p-5"
              >
                <div className="flex gap-4">
                  <span className="font-bold text-emerald-300">
                    {feature.number}
                  </span>

                  <div>
                    <h3 className="font-bold">{feature.title}</h3>
                    <p className="mt-2 leading-6 text-emerald-50/80">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-700">
              How it works
            </p>

            <h2 className="mt-4 text-4xl font-bold tracking-tight">
              Make every round count
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="rounded-3xl border border-slate-200 bg-[#f8f6f0] p-7"
              >
                <span className="text-sm font-bold text-emerald-700">
                  {feature.number}
                </span>

                <h3 className="mt-5 text-2xl font-bold">
                  {feature.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-14 rounded-[2rem] bg-amber-300 px-7 py-10 sm:flex sm:items-center sm:justify-between sm:px-10">
            <div>
              <h2 className="text-3xl font-bold">
                Ready to make an impact?
              </h2>

              <p className="mt-2 text-slate-800">
                Create your account and select the charity you want to
                support.
              </p>
            </div>

            <Link
              href="/signup"
              className="mt-6 inline-block rounded-full bg-slate-950 px-7 py-3 font-semibold text-white transition hover:bg-slate-800 sm:mt-0"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
