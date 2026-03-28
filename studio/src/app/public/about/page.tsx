import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/src/config/site";

export default function AboutPage() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-6 py-8">
        <Image
          src="/aurrin-logo.jpeg"
          alt="Aurrin Ventures"
          width={120}
          height={120}
          className="rounded-2xl"
        />
        <div className="text-center max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            About Aurrin Ventures
          </h1>
          <p className="text-lg text-default-500 mt-4 leading-relaxed">
            Calgary&apos;s home for early-stage founders.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="my-12 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 border border-violet-500/20">
        <h2 className="text-xl font-semibold mb-3">Our Mission</h2>
        <p className="text-default-600 dark:text-default-400 leading-relaxed">
          Aurrin Ventures&apos; mission is to support early-stage founders by
          creating a high-frequency, low-barrier environment where they can pitch
          ideas early and often, gain fast feedback, and build momentum through
          community and action.
        </p>
      </section>

      {/* What We Do */}
      <section className="my-12 space-y-6">
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium tracking-wide uppercase mb-4">
            What We Do
          </span>
          <h2 className="text-2xl md:text-3xl font-semibold">
            Building the Startup Ecosystem
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xl mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">Pitch Events</h3>
            <p className="text-default-500 text-sm">
              Regular pitch nights where early-stage founders present their ideas
              and receive constructive feedback from experienced evaluators.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xl mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">Community & Feedback</h3>
            <p className="text-default-500 text-sm">
              A supportive community where founders connect with judges, mentors,
              and fellow entrepreneurs to refine their concepts.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xl mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">Ecosystem Partnerships</h3>
            <p className="text-default-500 text-sm">
              Collaborating with organizations across Calgary to build a
              thriving startup ecosystem that supports founders at every stage.
            </p>
          </div>
        </div>
      </section>

      {/* Get Involved */}
      <section className="my-12 space-y-6">
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium tracking-wide uppercase mb-4">
            Get Involved
          </span>
          <h2 className="text-2xl md:text-3xl font-semibold">
            There&apos;s a Place for Everyone
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 text-center">
            <h3 className="font-semibold text-lg mb-2">Pitch at Events</h3>
            <p className="text-default-500 text-sm mb-4">
              Submit your idea to pitch and receive constructive feedback from
              experienced evaluators.
            </p>
            <a
              href={siteConfig.links.pitchSignup}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
            >
              Apply to Pitch
            </a>
          </div>

          <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 text-center">
            <h3 className="font-semibold text-lg mb-2">Become a Judge</h3>
            <p className="text-default-500 text-sm mb-4">
              Contribute your expertise by reviewing pitches and helping
              early-stage entrepreneurs refine their ideas.
            </p>
            <a
              href={siteConfig.links.judgeSignup}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2 rounded-full border border-violet-500 text-violet-500 hover:bg-violet-500 hover:text-white text-sm font-medium transition-all"
            >
              Apply to Judge
            </a>
          </div>

          <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 text-center">
            <h3 className="font-semibold text-lg mb-2">Partner With Us</h3>
            <p className="text-default-500 text-sm mb-4">
              Collaborate on events or support the broader startup ecosystem in
              Calgary.
            </p>
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="inline-block px-5 py-2 rounded-full border border-violet-500 text-violet-500 hover:bg-violet-500 hover:text-white text-sm font-medium transition-all"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </section>

      {/* Ecosystem Partners */}
      <section className="my-12">
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium tracking-wide uppercase mb-4">
            Our Ecosystem
          </span>
          <h2 className="text-2xl font-semibold">Partners & Collaborators</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {["In The Know YYC", "Black Business Ventures Association", "Heliopolis"].map(
            (partner) => (
              <span
                key={partner}
                className="px-5 py-2.5 rounded-full border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 text-default-600 text-sm font-medium"
              >
                {partner}
              </span>
            )
          )}
        </div>
      </section>

      {/* Contact */}
      <section className="my-12 p-8 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-center">
        <h2 className="text-xl font-semibold text-white mb-3">
          Get in Touch
        </h2>
        <p className="text-white/90 mb-6 max-w-lg mx-auto">
          Questions, partnerships, or just want to say hello? We&apos;d love to
          hear from you.
        </p>
        <a
          href={`mailto:${siteConfig.contactEmail}`}
          className="inline-block px-6 py-3 rounded-full bg-white text-violet-600 font-semibold hover:bg-white/90 transition-colors shadow-lg"
        >
          {siteConfig.contactEmail}
        </a>
      </section>

      <div className="mt-12 pt-8 border-t border-default-200 dark:border-gray-700">
        <Link
          href="/"
          className="text-violet-500 hover:text-violet-400 transition-colors"
        >
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
