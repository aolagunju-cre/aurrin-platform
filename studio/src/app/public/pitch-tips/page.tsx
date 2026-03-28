import Link from "next/link";
import { siteConfig } from "@/src/config/site";

export default function PitchTipsPage() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <section className="flex flex-col items-center justify-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tips for Your Next Pitch</h1>
        <p className="text-default-500 mt-2 text-center max-w-xl">
          Get ready to share your idea in three minutes.
        </p>
      </section>

      {/* Intro card */}
      <div className="mb-12 p-6 md:p-8 rounded-2xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 border border-violet-500/20">
        <h2 className="text-xl font-semibold mb-3">How to Deliver a Great 3-Minute Startup Pitch</h2>
        <p className="text-default-600 dark:text-default-400">
          At Aurrin Ventures, many founders present their ideas in a 3-minute pitch format. Three minutes goes by very quickly, so the most important things to focus on are <strong>clarity</strong>, <strong>structure</strong>, and <strong>confidence</strong>.
        </p>
        <p className="text-default-600 dark:text-default-400 mt-3">
          Below are a few suggestions that may help you prepare.
        </p>
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none text-default-600 dark:text-default-400 space-y-8">

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">1</span>
          <div>
            <h3 className="text-lg font-medium mt-0">Start With a Strong Hook</h3>
            <p className="mt-2">The first 10-15 seconds matter the most.</p>
          </div>
        </div>
        <div className="ml-12">
          <p>Try opening with a short personal story or moment that explains why this problem matters to you.</p>
          <p>For example:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>A problem you personally experienced</li>
            <li>Someone you know who struggled with the issue</li>
            <li>A surprising statistic or insight</li>
          </ul>
          <p>The goal is to pull the audience in right away.</p>
        </div>

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">2</span>
          <div>
            <h3 className="text-lg font-medium mt-0">Follow a Simple Structure</h3>
          </div>
        </div>
        <div className="ml-12">
          <p>A clear structure helps people follow along and understand your idea quickly.</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>The Problem</strong> — What problem are you solving, and who experiences it?</li>
            <li><strong>The Solution</strong> — What are you building, and how does it solve that problem?</li>
            <li><strong>Why Now / Why You</strong> — Why is this the right time, and why are you the right person?</li>
            <li><strong>Progress So Far</strong> — Have you built a prototype? Talked to customers? Any traction helps.</li>
            <li><strong>Impact / Vision</strong> — What could this become if it works?</li>
          </ul>
        </div>

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">3</span>
          <div>
            <h3 className="text-lg font-medium mt-0">Keep the Language Simple</h3>
          </div>
        </div>
        <div className="ml-12">
          <p>Avoid jargon or overly technical explanations. Explain your idea in a way that anyone could understand.</p>
          <div className="my-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="font-medium mb-0 italic">&quot;Clarity always beats complexity.&quot;</p>
          </div>
        </div>

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">4</span>
          <div>
            <h3 className="text-lg font-medium mt-0">Practice With a Timer</h3>
            <p className="mt-2">Three minutes is shorter than it sounds.</p>
          </div>
        </div>
        <div className="ml-12">
          <p>Practice several times and aim to finish around 2:45-2:55 so you don&apos;t get cut off.</p>
        </div>

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">5</span>
          <div>
            <h3 className="text-lg font-medium mt-0">Delivery Tips</h3>
          </div>
        </div>
        <div className="ml-12">
          <ul className="list-disc pl-6 space-y-2">
            <li>Keep the microphone close to your mouth</li>
            <li>Speak slightly slower than normal</li>
            <li>Take a few deep breaths before starting</li>
            <li>Pause briefly between sections</li>
          </ul>
        </div>

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">6</span>
          <div>
            <h3 className="text-lg font-medium mt-0">Props Can Help</h3>
          </div>
        </div>
        <div className="ml-12">
          <p>If you have a prototype, product, or physical example, props can be very effective and make your pitch more engaging.</p>
        </div>

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">7</span>
          <div>
            <h3 className="text-lg font-medium mt-0">Be Ready for Questions</h3>
          </div>
        </div>
        <div className="ml-12">
          <p>Common questions include:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Who is your customer?</li>
            <li>How large is the market?</li>
            <li>How will the business make money?</li>
            <li>What makes your solution different?</li>
          </ul>
          <p>If you don&apos;t know the answer, it&apos;s fine to say you&apos;re still exploring.</p>
        </div>

        <div className="flex gap-4 mt-10">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-semibold">8</span>
          <div>
            <h3 className="text-lg font-medium mt-0">End With a Clear Closing Line</h3>
          </div>
        </div>
        <div className="ml-12">
          <p>For example:</p>
          <p className="italic">&quot;We&apos;re building [product] so that [group of people] can finally solve [problem].&quot;</p>
        </div>

        {/* Have Fun */}
        <div className="my-12 p-6 rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border border-violet-500/30">
          <p className="text-violet-600 dark:text-violet-400 font-semibold text-lg mb-2">Most Importantly: Have Fun</p>
          <p className="text-default-600 dark:text-default-400 mb-2">
            Pitch events are meant to support early founders. The audience, judges, and other entrepreneurs are all there because they want to see new ideas succeed.
          </p>
          <p className="text-default-600 dark:text-default-400 mb-0">
            Take a deep breath, enjoy the moment, and share what you&apos;re building.
          </p>
        </div>

        {/* Common Mistakes */}
        <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <h2 className="text-xl font-semibold mt-0 mb-3">Common Pitch Mistakes</h2>
          <ul className="list-disc pl-6 space-y-2 mb-0">
            <li><strong>Talking too fast</strong> — Speak slower than you normally would.</li>
            <li><strong>Trying to explain everything</strong> — Focus on the core idea, not every feature.</li>
            <li><strong>Too much technical detail</strong> — The audience cares about the problem, solution, and impact.</li>
            <li><strong>Not clearly explaining the problem</strong> — Don&apos;t jump straight to the solution.</li>
            <li><strong>Weak ending</strong> — End with a clear and confident closing statement.</li>
          </ul>
        </div>

        {/* What Judges Look For */}
        <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50/50 dark:bg-default-50/5">
          <h2 className="text-xl font-semibold mt-0 mb-3">What Judges Are Looking For</h2>
          <ul className="list-disc pl-6 space-y-2 mb-0">
            <li><strong>Business Potential</strong> — Could this become a sustainable business?</li>
            <li><strong>Clarity</strong> — Was the idea easy to understand?</li>
            <li><strong>Impact</strong> — Does solving this problem matter?</li>
            <li><strong>Structure</strong> — Was the pitch organized and well paced?</li>
            <li><strong>Engagement</strong> — Did it make the audience curious?</li>
          </ul>
        </div>

        {/* Sample Videos */}
        <div className="p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50/50 dark:bg-default-50/5">
          <h2 className="text-xl font-semibold mt-0 mb-3">Sample Pitch Videos</h2>
          <p className="mb-6">Watch founders who have pitched at Aurrin Ventures events.</p>
          <ul className="space-y-4 mb-0">
            <li>
              <span className="font-medium">Victoria Tsang — Evolving Prowess</span>{" "}
              <a href="https://drive.google.com/file/d/1vc18ceofdYjuG9erSM1y6tSL6DhUdd0D/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-400">Watch the pitch →</a>
            </li>
            <li>
              <span className="font-medium">Giovanna Acosta — Synfera</span>{" "}
              <a href="https://drive.google.com/file/d/1gN6VwAhA5aOe4lsUpUg7L6RUnTyYnq3-/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-400">Watch the pitch →</a>
            </li>
            <li>
              <span className="font-medium">Haden Harrison — Agrivanna</span>{" "}
              <a href="https://drive.google.com/file/d/1eG5CnRxGsgQKctlMe7bsRL4LFoLqvXhY/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-400">Watch the pitch →</a>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-10 p-8 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-center">
          <h2 className="text-xl font-semibold text-white mt-0 mb-3">Want to Pitch at Aurrin Ventures?</h2>
          <p className="text-white/90 mb-6 max-w-lg mx-auto">
            If you&apos;re building something interesting and would like to present your idea at a future event, we would love to hear from you.
          </p>
          <a
            href={siteConfig.links.pitchSignup}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-full bg-white text-violet-600 font-semibold hover:bg-white/90 transition-colors shadow-lg"
          >
            Apply to pitch →
          </a>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-default-200 dark:border-gray-700">
        <Link href="/public/portfolio" className="text-violet-500 hover:text-violet-400 transition-colors">
          ← Back to Portfolio
        </Link>
      </div>
    </div>
  );
}
