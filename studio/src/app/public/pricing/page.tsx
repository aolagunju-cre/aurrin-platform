import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <section className="flex flex-col items-center justify-center gap-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Pricing
        </h1>
        <p className="text-lg text-default-500 mt-2 text-center max-w-xl">
          Access exclusive founder resources, ecosystem maps, and research
          insights.
        </p>
      </section>

      {/* Plan Card */}
      <section className="my-12 max-w-md mx-auto">
        <div className="p-8 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-fuchsia-500/5 to-violet-500/5">
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium tracking-wide uppercase mb-4">
              Research Hub
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-foreground">$100</span>
              <span className="text-default-500">/month</span>
            </div>
          </div>

          <ul className="space-y-4 mb-8">
            {[
              "Calgary startup ecosystem maps",
              "Curated founder resources",
              "Research and industry insights",
              "Relevant events for founders",
              "Exclusive community access",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-default-600 dark:text-default-400">
                  {feature}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/auth/sign-up"
            className="block w-full text-center px-6 py-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* FAQ / Details */}
      <section className="my-12 space-y-6">
        <h2 className="text-2xl font-semibold text-center mb-8">
          Frequently Asked Questions
        </h2>

        {[
          {
            q: "What is the Research Hub?",
            a: "The Research Hub provides subscribers with access to Calgary startup ecosystem maps, curated founder resources, research insights, and a calendar of relevant events.",
          },
          {
            q: "Can I cancel anytime?",
            a: "Yes. Your subscription is month-to-month and can be cancelled at any time from your account dashboard.",
          },
          {
            q: "Do I need a subscription to pitch?",
            a: "No. Pitching at Aurrin Ventures events is free. The subscription is for access to premium research and resources.",
          },
          {
            q: "How do I access the Research Hub after subscribing?",
            a: "After subscribing, sign in to your account and navigate to the Subscriber portal where all premium content is available.",
          },
        ].map((item) => (
          <div
            key={item.q}
            className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5"
          >
            <h3 className="font-semibold mb-2">{item.q}</h3>
            <p className="text-default-500 text-sm">{item.a}</p>
          </div>
        ))}
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
