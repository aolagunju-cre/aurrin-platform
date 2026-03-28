import { HeroSection } from "@/src/components/public/HeroSection";
import { FeaturedCampaigns } from "@/src/components/public/FeaturedCampaigns";
import Link from "next/link";
import { siteConfig } from "@/src/config/site";

export default function Home() {
  return (
    <div>
      <HeroSection />
      <FeaturedCampaigns />

      {/* Ecosystem CTA */}
      <section className="py-12">
        <div className="p-8 md:p-10 rounded-2xl bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 border border-violet-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                Join Calgary&apos;s Startup Ecosystem
              </h2>
              <p className="text-default-500 max-w-lg">
                Whether you&apos;re a founder, judge, mentor, or supporter — there&apos;s
                a place for you at Aurrin Ventures.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/public/events"
                className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
              >
                Upcoming Events
              </Link>
              <a
                href={siteConfig.links.judgeSignup}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 rounded-full border border-violet-500 text-violet-500 hover:bg-violet-500 hover:text-white font-medium transition-all"
              >
                Become a Judge
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
