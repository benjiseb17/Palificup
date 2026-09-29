import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const NAV = [
  { id: "deroulement", label: "🎲 Déroulement" },
  { id: "surencherir", label: "📈 Surenchérir" },
  { id: "choix", label: "🤔 Le choix" },
  { id: "special", label: "⭐ Règles spéciales" },
];

export default function ReglesPage() {
  return (
    <>
      <SiteHeader
        subtitle="Règles du jeu"
        right={
          <Link href="/" className="text-sm font-semibold text-orange-label underline underline-offset-2">
            ← Ma table
          </Link>
        }
      />
      <main className="flex flex-1 flex-col px-6 py-8 max-w-2xl w-full mx-auto">
        <h1 className="text-3xl font-black text-ink mb-1">🎲 Les règles du Perudo</h1>
        <p className="text-caramel mb-6">
          Un jeu de bluff aux dés : annonce, doute, et tente ta chance. Voici tout ce qu&apos;il
          faut savoir pour jouer comme un pro à La Palificup.
        </p>

        <nav className="flex flex-wrap gap-2 mb-8">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="rounded-full bg-cream-card px-3 py-1.5 text-sm font-semibold text-orange-label hover:bg-separator"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <Section id="deroulement" icon="🎲" title="Déroulement du jeu">
          <Step n={1} title="Lancer des dés">
            Tous les joueurs secouent leurs gobelets et cachent leurs dés — personne ne voit les
            dés des autres, ni même les siens tant qu&apos;il ne les a pas regardés.
          </Step>
          <Step n={2} title="Faire une annonce">
            Le premier joueur annonce un nombre de dés et une valeur, par exemple :{" "}
            <Quote>Il y a au moins 5 dés de valeur 2.</Quote> Il peut bluffer ou se rapprocher de
            la réalité — à toi de deviner. Les annonces se font dans le sens horaire.
          </Step>
        </Section>

        <Section id="surencherir" icon="📈" title="Surenchérir">
          <Rule>
            À son tour, un joueur peut augmenter soit le <strong>nombre</strong> de dés, soit la{" "}
            <strong>valeur</strong> annoncée — mais toujours vers le haut, jamais les deux à la
            fois vers le bas.
          </Rule>
          <Example>
            Gabriel annonce <Quote>4 dés de valeur 5</Quote>. Benjamin peut surenchérir en disant{" "}
            <Quote>5 dés de valeur 3</Quote> (le nombre de dés a augmenté) ou bien{" "}
            <Quote>4 dés de valeur 6</Quote> (c&apos;est la valeur qui a augmenté).
          </Example>

          <Rule>
            Un joueur peut aussi annoncer en <Term>Paco</Term>. Les paco sont spéciaux : il faut
            annoncer au moins un nombre de paco égal à la moitié de la proposition précédente
            (toujours arrondie à l&apos;entier supérieur).
          </Rule>
          <Example>
            Louis surenchérit sur l&apos;annonce de Benjamin en disant <Quote>3 pacos</Quote>.
            Benjamin peut surenchérir en disant <Quote>6 dés de valeur 3</Quote> ou bien{" "}
            <Quote>4 pacos</Quote> — pour annoncer des paco on divise par deux le nombre de dés,
            et pour surenchérir sur un dé d&apos;une autre valeur à partir de paco, on double le
            nombre de dés annoncés.
          </Example>

          <Rule>
            Une fois qu&apos;un joueur a annoncé un certain nombre de paco, le joueur suivant peut
            soit augmenter ce nombre de paco, soit repasser sur une valeur de dé classique — mais
            dans ce cas, il doit proposer un nombre de dés au moins égal à la proposition
            précédente, plus un.
          </Rule>
        </Section>

        <Section id="choix" icon="🤔" title="Le choix : y croire ou douter ?">
          <p className="text-caramel mb-4">
            Plutôt que de surenchérir, tu peux aussi trancher sur l&apos;annonce du joueur
            précédent. Deux options s&apos;offrent à toi :
          </p>
          <ChoiceCard
            emoji="🚨"
            badge="Perudo"
            altBadge="Dudo"
            title="Tu penses que c'est du bluff"
            accent="accent"
          >
            <p>
              Tu penses que l&apos;annonce du joueur précédent est fausse, c&apos;est-à-dire
              qu&apos;il y a <strong>strictement moins</strong> de dés que l&apos;annonce sur la
              table.
            </p>
            <Outcome good>Tu as raison → le joueur précédent perd un dé.</Outcome>
            <Outcome>Tu as tort → tu perds un dé.</Outcome>
          </ChoiceCard>
          <ChoiceCard
            emoji="🎯"
            badge="Casal"
            altBadge="Tout pile"
            title="Tu penses que c'est pile juste"
            accent="gold"
          >
            <p>
              Tu penses que l&apos;annonce du joueur précédent indique{" "}
              <strong>exactement</strong> le nombre de dés présents sur la table.
            </p>
            <Outcome good>
              Tu as raison → tu gagnes un dé. Si tu en as déjà 5, tu gagnes un{" "}
              <strong>crédit</strong> (une vie supplémentaire pour ta prochaine erreur).
            </Outcome>
            <Outcome>Tu as tort → tu perds un dé.</Outcome>
          </ChoiceCard>
        </Section>

        <Section id="special" icon="⭐" title="Règles spéciales">
          <Rule>
            <Term>Paco</Term> / <Term>Indien</Term> — les dés jokers : les dés affichant la valeur{" "}
            <strong>1</strong> sont des jokers et peuvent prendre la valeur de n&apos;importe
            quelle annonce.
          </Rule>
          <Rule>
            <Term>Palifico</Term> : quand un joueur n&apos;a plus qu&apos;un seul dé, il devient
            « palifico ». Les paco perdent leur pouvoir de joker, et les joueurs suivants ne
            peuvent plus changer la valeur annoncée — seulement le nombre de dés.
          </Rule>
          <Example>
            Nicolas vient de perdre son 4e dé : il est désormais palifico, et c&apos;est à lui de
            commencer. Il annonce <Quote>2 dés de valeur 3</Quote> — ici, les 1 ne comptent plus
            comme des 3 : seuls les dés réellement sur la face 3 comptent, et les joueurs suivants
            doivent surenchérir uniquement sur des 3. De même, quand Nicolas devra lui-même
            surenchérir sur le joueur précédent, les 1 ne compteront plus comme jokers pour lui non
            plus. En revanche, si Nicolas décide de dire casal ou perudo sur l&apos;annonce
            précédente, on recompte alors les dés en tenant compte des éventuels paco présents sur
            la table.
          </Example>
        </Section>

        <p className="text-center text-caramel text-sm mt-4 mb-8">
          Bon jeu, et que le bluff soit avec toi 🎲🍀
        </p>
      </main>
    </>
  );
}

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 mb-8 rounded-xl bg-cream-alt border border-separator shadow-sm p-5">
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-ink mb-4">
        <span aria-hidden>{icon}</span> {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-black text-white">
        {n}
      </span>
      <p className="text-caramel">
        <strong className="text-ink">{title}</strong> : {children}
      </p>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-caramel flex gap-2">
      <span className="text-accent" aria-hidden>
        •
      </span>
      <span>{children}</span>
    </p>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-cream-row border border-separator px-3 py-2.5 text-sm text-caramel">
      <p className="text-[11px] font-bold uppercase tracking-widest text-orange-label mb-1">
        💬 Exemple
      </p>
      {children}
    </div>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-ink">« {children} »</span>;
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-sm font-bold text-accent">
      {children}
    </span>
  );
}

function ChoiceCard({
  emoji,
  badge,
  altBadge,
  title,
  accent,
  children,
}: {
  emoji: string;
  badge: string;
  altBadge: string;
  title: string;
  accent: "accent" | "gold";
  children: React.ReactNode;
}) {
  const border = accent === "accent" ? "border-accent" : "border-gold";
  const badgeClass =
    accent === "accent" ? "bg-accent text-white" : "bg-gold text-white";
  return (
    <div className={`rounded-xl border-2 ${border} bg-cream-row p-4`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xl" aria-hidden>
          {emoji}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-black tracking-wide ${badgeClass}`}>
          {badge}
        </span>
        <span className="text-caramel text-xs">(ou « {altBadge} »)</span>
        <span className="font-extrabold text-ink ml-auto">{title}</span>
      </div>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

function Outcome({ good, children }: { good?: boolean; children: React.ReactNode }) {
  return (
    <p className={`font-semibold ${good ? "text-good" : "text-bad"}`}>
      {good ? "✅" : "❌"} {children}
    </p>
  );
}
