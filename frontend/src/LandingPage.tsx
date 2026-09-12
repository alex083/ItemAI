import { type FormEvent, useEffect, useState } from "react";
import { Button, Input, TextArea } from "@heroui/react";
import { Link, useNavigate } from "react-router-dom";

import { listTariffs, type Tariff } from "./api";

function buildDemoCopy(title: string) {
  const name = title.trim() || "Your product";
  return {
    heading: name,
    body:
      `${name} is a professional product built for everyday use. ` +
      `This sample highlights key features, buyer benefits, and natural search-friendly wording. ` +
      `The copy is ready to place in a catalog or marketplace listing.`,
    bullets: [
      "Structured for a product card",
      "Readable tone without keyword stuffing",
      "Refine style later in your profile",
    ],
  };
}

function formatPrice(price: string) {
  const value = Number(price);
  if (Number.isNaN(value)) return price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LandingPage() {
  const navigate = useNavigate();
  const [demoTitle, setDemoTitle] = useState("Wireless Headphones Pro X");
  const [demoResult, setDemoResult] = useState(() => buildDemoCopy("Wireless Headphones Pro X"));
  const [demoBusy, setDemoBusy] = useState(false);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    listTariffs()
      .then((items) => setTariffs(items.filter((t) => t.is_active).slice(0, 3)))
      .catch(() => setTariffs([]));
  }, []);

  function onDemo(event: FormEvent) {
    event.preventDefault();
    setDemoBusy(true);
    window.setTimeout(() => {
      setDemoResult(buildDemoCopy(demoTitle));
      setDemoBusy(false);
    }, 450);
  }

  function onContact(event: FormEvent) {
    event.preventDefault();
    const subject = encodeURIComponent(`ItemAI: request from ${contactName || "guest"}`);
    const body = encodeURIComponent(
      `Name: ${contactName}\nEmail: ${contactEmail}\n\n${contactMessage}`,
    );
    window.location.href = `mailto:support@itemai.app?subject=${subject}&body=${body}`;
    setContactSent(true);
  }

  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5 md:px-6">
          <a href="#top" className="font-brand text-lg font-semibold text-foreground">
            Item<span className="text-[var(--accent)]">AI</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <a className="hover:text-foreground" href="#how">
              How it works
            </a>
            <a className="hover:text-foreground" href="#features">
              Features
            </a>
            <a className="hover:text-foreground" href="#pricing">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onPress={() => navigate("/login")}>
              Sign in
            </Button>
            <Button size="sm" onPress={() => navigate("/register")}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero__atmosphere" aria-hidden />
          <div className="mx-auto grid min-h-[calc(100svh-4.25rem)] max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-[1.05fr_0.95fr] md:gap-14 md:px-6 md:py-16">
            <div className="landing-reveal space-y-7">
              <p className="font-brand text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Item<span className="text-[var(--accent)]">AI</span>
              </p>
              <h1 className="font-display text-[2rem] font-semibold leading-[1.12] tracking-tight text-foreground md:text-[2.75rem]">
                Generate thousands of unique SEO product descriptions in minutes
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted md:text-lg">
                Artificial intelligence creates professional, search-optimized copy based on your
                catalog attributes and profile rules.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onPress={() => navigate("/register")}>
                  Generate your first description
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onPress={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Try the demo
                </Button>
              </div>
            </div>

            <div id="demo" className="landing-reveal landing-reveal--delay landing-demo">
              <form className="space-y-4" onSubmit={onDemo}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Product name</span>
                  <Input
                    fullWidth
                    value={demoTitle}
                    onChange={(event) => setDemoTitle(event.target.value)}
                    placeholder="e.g. Trail Run 2 sneakers"
                    aria-label="Product name for demo"
                  />
                </label>
                <Button type="submit" fullWidth isPending={demoBusy} isDisabled={demoBusy}>
                  Generate sample
                </Button>
              </form>
              <div className="landing-demo__result" aria-live="polite">
                <p className="font-display text-lg font-semibold text-foreground">{demoResult.heading}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{demoResult.body}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-foreground/80">
                  {demoResult.bullets.map((item) => (
                    <li key={item}>— {item}</li>
                  ))}
                </ul>
                <p className="mt-5 text-xs text-muted">
                  Demo sample on the homepage. Full generation happens after you sign up and open a
                  profile.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/50 bg-white/35 py-12 backdrop-blur-sm" id="proof">
          <div className="mx-auto max-w-6xl px-5 md:px-6">
            <p className="text-center text-sm font-medium uppercase tracking-[0.14em] text-muted">
              Built for catalogs and marketplaces
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-semibold text-foreground/70">
              <span>Amazon</span>
              <span>Shopify</span>
              <span>WooCommerce</span>
              <span>OpenCart</span>
              <span>CSV / Excel</span>
            </div>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              <div>
                <p className="font-display text-3xl font-semibold text-[var(--accent)]">up to 80%</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  less time spent filling product cards
                </p>
              </div>
              <div>
                <p className="font-display text-3xl font-semibold text-[var(--accent)]">1 click</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  from product title to SEO-ready description in a profile
                </p>
              </div>
              <div>
                <p className="font-display text-3xl font-semibold text-[var(--accent)]">BYOK</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  use your own API key or the platform key, depending on your plan
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20" id="features">
          <div className="mx-auto max-w-6xl px-5 md:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Features</h2>
            <p className="mt-3 max-w-2xl text-muted">
              Tools to fill your catalog fast without writing every listing by hand.
            </p>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              <div>
                <h3 className="font-display text-xl font-semibold">Bulk import</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Upload products via CSV/Excel, work in batches inside profiles, and export results
                  back to your catalog.
                </p>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold">SEO without spam</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Descriptions with natural structure, useful keywords, and readable copy for both
                  shoppers and search.
                </p>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold">Brand tone</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Tune prompts and profiles for an expert, friendly, or premium voice that matches
                  your store.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/50 bg-white/40 py-16 md:py-20" id="how">
          <div className="mx-auto max-w-6xl px-5 md:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">How it works</h2>
            <p className="mt-3 max-w-2xl text-muted">Three steps from catalog to ready descriptions.</p>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              <li className="space-y-3">
                <span className="font-brand text-sm font-semibold text-[var(--accent)]">01</span>
                <h3 className="font-display text-xl font-semibold">Add your products</h3>
                <p className="text-sm leading-relaxed text-muted">
                  Create a profile and enter products manually or import a CSV.
                </p>
              </li>
              <li className="space-y-3">
                <span className="font-brand text-sm font-semibold text-[var(--accent)]">02</span>
                <h3 className="font-display text-xl font-semibold">Set generation rules</h3>
                <p className="text-sm leading-relaxed text-muted">
                  Choose a prompt template, tone, and key mode (platform or your own).
                </p>
              </li>
              <li className="space-y-3">
                <span className="font-brand text-sm font-semibold text-[var(--accent)]">03</span>
                <h3 className="font-display text-xl font-semibold">Get unique descriptions</h3>
                <p className="text-sm leading-relaxed text-muted">
                  Generate listing copy and use it on your site or marketplace.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="py-16 md:py-20" id="pricing">
          <div className="mx-auto max-w-6xl px-5 md:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Pricing</h2>
            <p className="mt-3 max-w-2xl text-muted">
              Clear packages based on profiles, products, and generations. Own-key plans are not
              limited by platform generation credits.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {tariffs.length > 0
                ? tariffs.map((tariff) => (
                    <div key={tariff.id} className="landing-plan">
                      <h3 className="font-display text-xl font-semibold">{tariff.title}</h3>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">
                        {formatPrice(tariff.price)}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-muted">
                        {tariff.description || "A package for filling your catalog."}
                      </p>
                      <ul className="mt-5 space-y-2 text-sm text-foreground/85">
                        <li>{tariff.number_of_profiles} profiles</li>
                        <li>{tariff.number_of_products} products</li>
                        {tariff.keypolicy === "byok" ? (
                          <li>Own key · no generation limit</li>
                        ) : (
                          <li>{tariff.number_of_generations} generations</li>
                        )}
                      </ul>
                      <Button className="mt-6" fullWidth onPress={() => navigate("/register")}>
                        Choose plan
                      </Button>
                    </div>
                  ))
                : [
                    {
                      title: "Starter",
                      price: "for small businesses",
                      points: ["A few profiles", "CSV import", "Platform key"],
                    },
                    {
                      title: "Business",
                      price: "for mid-size stores",
                      points: ["More products", "Flexible prompts", "Hybrid key mode"],
                    },
                    {
                      title: "Scale",
                      price: "for large catalogs",
                      points: ["High limits", "Own API key", "Built for volume"],
                    },
                  ].map((plan) => (
                    <div key={plan.title} className="landing-plan">
                      <h3 className="font-display text-xl font-semibold">{plan.title}</h3>
                      <p className="mt-2 text-lg font-medium text-muted">{plan.price}</p>
                      <ul className="mt-5 space-y-2 text-sm text-foreground/85">
                        {plan.points.map((point) => (
                          <li key={point}>— {point}</li>
                        ))}
                      </ul>
                      <Button className="mt-6" fullWidth onPress={() => navigate("/register")}>
                        Choose plan
                      </Button>
                    </div>
                  ))}
            </div>
          </div>
        </section>

        <section
          className="border-t border-white/50 bg-[color-mix(in_oklch,var(--accent)_8%,white)] py-16 md:py-20"
          id="cta"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2 md:px-6">
            <div className="space-y-5">
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                Get your first descriptions after you register
              </h2>
              <p className="text-muted">
                Create an account, pick a plan, and generate product cards for your catalog.
              </p>
              <Button size="lg" onPress={() => navigate("/register")}>
                Try for free
              </Button>
            </div>
            <form className="landing-contact space-y-3" onSubmit={onContact}>
              <h3 className="font-display text-xl font-semibold">Contact support</h3>
              <Input
                fullWidth
                placeholder="Name"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                aria-label="Name"
              />
              <Input
                fullWidth
                type="email"
                placeholder="Email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                required
                aria-label="Email"
              />
              <TextArea
                fullWidth
                placeholder="Briefly describe your request"
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                required
                aria-label="Message"
              />
              <Button type="submit" variant="outline">
                Send message
              </Button>
              {contactSent ? (
                <p className="text-sm text-muted">Your email client will open to send the message.</p>
              ) : null}
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-sm text-muted md:px-6">
          <span className="font-brand font-semibold text-foreground">
            Item<span className="text-[var(--accent)]">AI</span>
          </span>
          <div className="flex gap-4">
            <Link className="hover:text-foreground" to="/login">
              Sign in
            </Link>
            <Link className="hover:text-foreground" to="/register">
              Register
            </Link>
          </div>
          <span>© {new Date().getFullYear()} ItemAI</span>
        </div>
      </footer>
    </div>
  );
}
