import { SHOWROOM } from "@/lib/content/home";
import SectionHeading from "./SectionHeading";
import SmartImage from "./SmartImage";
import GoldButton from "./GoldButton";
import Reveal from "./Reveal";

export default function ShowroomSection() {
  return (
    <section
      id={SHOWROOM.id}
      className="flex flex-col items-center gap-8 px-5 py-20 sm:px-6 sm:py-28"
      aria-labelledby="showroom-heading"
    >
      <Reveal className="flex w-full flex-col items-center gap-8">
        <SectionHeading
          eyebrow={SHOWROOM.eyebrow}
          segments={SHOWROOM.heading}
          description={SHOWROOM.description}
          id="showroom-heading"
        />

        <div className="relative aspect-[4/3] w-full max-w-3xl overflow-hidden rounded-glass glass-flat glass-gold specular sm:aspect-[16/10]">
          <SmartImage
            src={SHOWROOM.image.src}
            alt={SHOWROOM.image.alt}
            label={SHOWROOM.image.label}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 80vw, 768px"
          />
        </div>

        <GoldButton href={SHOWROOM.cta.href}>{SHOWROOM.cta.label}</GoldButton>
      </Reveal>
    </section>
  );
}
