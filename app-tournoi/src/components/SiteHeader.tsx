import Image from "next/image";
import Link from "next/link";

export default function SiteHeader({
  subtitle,
  right,
}: {
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-[3px] border-accent bg-cream-header px-4 py-3 sm:px-6">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Palificup"
          width={40}
          height={40}
          className="rounded-lg"
        />
        <div className="leading-tight">
          <div className="text-sm font-extrabold tracking-[2px] text-orange-label">
            LA PALIFICUP
          </div>
          <div className="text-[10px] uppercase tracking-[2px] text-orange-label/80">
            {subtitle}
          </div>
        </div>
      </Link>
      {right}
    </header>
  );
}
