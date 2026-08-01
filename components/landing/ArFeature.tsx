import { AR_FEATURE } from "@/lib/content/home";
import SectionHeading from "./SectionHeading";
import SmartImage from "./SmartImage";
import GoldButton from "./GoldButton";
import Reveal from "./Reveal";

export default function ArFeature() {
  return (
    <section
      className="flex flex-col items-center gap-8 px-5 py-20 sm:px-6 sm:py-24"
      aria-labelledby="ar-heading"
    >
      <Reveal className="flex w-full flex-col items-center gap-8">
        <SectionHeading
          eyebrow={AR_FEATURE.eyebrow}
          segments={AR_FEATURE.heading}
          description={AR_FEATURE.description}
          id="ar-heading"
        />

        <div className="relative aspect-[4/3] w-full max-w-xl overflow-hidden rounded-glass glass-flat glass-gold specular">
          <SmartImage
            src={AR_FEATURE.image.src}
            alt={AR_FEATURE.image.alt}
            label={AR_FEATURE.image.label}
            sizes="(max-width: 640px) 92vw, 576px"
          />
        </div>

        <GoldButton href={AR_FEATURE.cta.href} variant="outline">
          {AR_FEATURE.cta.label}
        </GoldButton>
      </Reveal>
    </section>
  );
}
