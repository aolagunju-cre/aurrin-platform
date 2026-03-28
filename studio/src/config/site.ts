export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Aurrin Ventures",
  description: "Founder discovery, scoring, and mentorship platform",
  navItems: [
    { label: "Events", href: "/public/events" },
    { label: "Portfolio", href: "/public/portfolio" },
    { label: "Directory", href: "/public/directory" },
    { label: "Apply", href: "/public/apply" },
  ],
  portalItems: [
    { label: "Founder", href: "/founder", description: "Dashboard, profile, events & reports" },
    { label: "Judge", href: "/judge/events", description: "Score founders at assigned events" },
    { label: "Mentor", href: "/mentor", description: "View matches & connect with founders" },
    { label: "Subscriber", href: "/subscriber", description: "Premium content & purchase history" },
    { label: "Admin", href: "/admin", description: "Platform management & analytics" },
  ],
  navMenuItems: [
    { label: "Events", href: "/public/events" },
    { label: "Portfolio", href: "/public/portfolio" },
    { label: "Directory", href: "/public/directory" },
    { label: "Apply", href: "/public/apply" },
    { label: "Founder Portal", href: "/founder" },
    { label: "Judge Portal", href: "/judge/events" },
    { label: "Mentor Portal", href: "/mentor" },
    { label: "Subscriber", href: "/subscriber" },
    { label: "Admin", href: "/admin" },
  ],
  links: {
    linkedin: "https://www.linkedin.com/company/aurrinventures/?viewAsMember=true",
    sponsor: "https://donate.stripe.com/00w4gzfVc6LS3XKfmf0RG00",
    events: "https://www.eventbrite.ca/o/aurrin-ventures-103419779111",
    pitchSignup: "https://forms.gle/HNRtWCv1eMG1SexY8",
    judgeSignup: "https://forms.gle/7JkmtQEstYajDEWYA",
  },
};
