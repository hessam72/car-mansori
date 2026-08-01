import {
  CALL_TO_ACTION,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HREF,
} from "@/lib/content/home";
import { Heading } from "./SectionHeading";
import GlassCard from "./GlassCard";
import GoldButton from "./GoldButton";
import { PhoneIcon } from "./icons";
import Reveal from "./Reveal";

export default function CallToAction() {
  return (
    <section
      className="px-5 py-16 sm:px-6 sm:py-20"
      aria-labelledby="cta-heading"
    >
      <Reveal>
        <GlassCard
          gold
          blurred
          className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-12 text-center sm:px-10 sm:py-14"
        >
          <Heading segments={CALL_TO_ACTION.heading} id="cta-heading" />
          <p className="font-persian max-w-md text-sm leading-[2] text-white/65 sm:text-base">
            {CALL_TO_ACTION.description}
          </p>

          <GoldButton
            href={CONTACT_PHONE_HREF}
            icon={<PhoneIcon className="h-4 w-4" />}
          >
            {CALL_TO_ACTION.buttonLabel}
            {/* bdi + dir=ltr stops RTL from reordering the digit run */}
            <bdi dir="ltr" className="persian-number tracking-wide">
              {CONTACT_PHONE_DISPLAY}
            </bdi>
          </GoldButton>
        </GlassCard>
      </Reveal>
    </section>
  );
}
