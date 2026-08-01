import { HERO } from "@/lib/content/home";
import { Heading, Eyebrow } from "./SectionHeading";
import SmartImage from "./SmartImage";
import ScrollCue from "./ScrollCue";
import Reveal from "./Reveal";

export default function Hero() {
  return (
    <section
      id="top"
      // svh, not vh: mobile browser chrome must not clip the cue off-screen.
      className="relative flex min-h-[100svh] flex-col items-center justify-center gap-6 px-5 pb-10 pt-24 sm:gap-8 sm:px-6 sm:pt-28"
      aria-labelledby="hero-heading"
    >
      <Reveal className="flex flex-col items-center gap-5 text-center">
        <Eyebrow>{HERO.eyebrow}</Eyebrow>

        {/* No frame: the image is masked to fade out on every edge and melt
            into the page gradient. */}
        <div className="relative aspect-[4/5] w-full max-w-[19rem] sm:max-w-md md:aspect-[16/11] md:max-w-3xl">
          <SmartImage
            src={HERO.image.src}
            alt={HERO.image.alt}
            label={HERO.image.label}
            priority
            blend
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 70vw, 768px"
          />
        </div>

        <Heading as="h1" id="hero-heading" segments={HERO.heading} />

        <p className="font-persian max-w-xl text-sm leading-[2] text-white/65 sm:text-base">
          {HERO.description}
        </p>
      </Reveal>

      <ScrollCue />
    </section>
  );
}
