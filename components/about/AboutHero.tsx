import AboutImage from "./AboutImage";
import AboutReveal from "./AboutReveal";
import { Eyebrow, Heading } from "./AboutHeading";
import type { AboutCopy } from "./content";

export default function AboutHero({ copy }: { copy: AboutCopy }) {
  return (
    <section className="about-hero" aria-labelledby="about-title">
      <AboutReveal className="about-hero-inner">
        <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
        <Heading as="h1" id="about-title" segments={copy.hero.heading} />
        <p className="about-lead">{copy.hero.lead}</p>
        <span className="about-scrollcue" aria-hidden="true">
          {copy.ui.scrollCue}
        </span>
      </AboutReveal>

      <AboutReveal className="about-hero-figure" delay={120}>
        <AboutImage
          slot={copy.hero.image}
          ratio="wide"
          priority
          blend
          sizes="(max-width: 1088px) 100vw, 1088px"
        />
      </AboutReveal>
    </section>
  );
}
