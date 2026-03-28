import Link from "next/link";
import Image from "next/image";

export function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center gap-8 py-16 md:py-24">
      <Image
        src="/aurrin-logo.jpeg"
        alt="Aurrin Ventures"
        width={180}
        height={180}
        className="rounded-2xl"
        priority
      />
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Aurrin Ventures
        </h1>
        <p className="text-lg md:text-xl text-default-500 mt-4 leading-relaxed">
          Calgary&apos;s home for early-stage founders. Pitch your idea, raise
          microgrants, and build momentum through community and action.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/public/directory"
          className="px-8 py-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
        >
          Support Founders
        </Link>
        <Link
          href="/public/apply"
          className="px-8 py-3 rounded-full border border-violet-500 text-violet-500 hover:bg-violet-500 hover:text-white font-medium transition-all"
        >
          Apply to Pitch
        </Link>
      </div>
    </section>
  );
}
