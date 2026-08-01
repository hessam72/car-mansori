import {
  BRAND,
  FOOTER,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HREF,
} from "@/lib/content/home";

export default function SiteFooter() {
  return (
    <footer className="px-5 pb-12 pt-6 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
        <div aria-hidden="true" className="gold-divider">
          <span className="h-1.5 w-1.5 rotate-45 bg-gold/70" />
        </div>

        <span className="font-persian text-sm font-extrabold tracking-[0.18em] text-gold-bright">
          {BRAND.name}
        </span>

        <p className="font-persian text-center text-xs leading-6 text-white/45">
          {FOOTER.description}
        </p>

        <a
          href={CONTACT_PHONE_HREF}
          className="font-persian text-sm font-bold text-white transition-colors hover:text-gold-bright"
        >
          <bdi dir="ltr" className="persian-number tracking-wide">
            {CONTACT_PHONE_DISPLAY}
          </bdi>
        </a>

        <p className="font-persian text-[0.68rem] text-white/30">
          © {BRAND.name} — {FOOTER.rights}
        </p>
      </div>
    </footer>
  );
}
