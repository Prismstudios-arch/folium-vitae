import { LegalPage, Section, Paragraph, Bullet, Highlight } from "@components/LegalText";

/**
 * Terms of use.
 *
 * DRAFT — needs review by a qualified lawyer before submission.
 *
 * The disclaimers in "Identification is a best guess" and "Toxicity and plant
 * health" are the ones that matter legally: the app gives advice about things
 * people eat, feed to animals, and spend real money on. SPEC §10 requires
 * these be clear and non-panicky, and never phrased as medical advice.
 */
export default function TermsScreen() {
  return (
    <LegalPage title="Terms of use">
      <Paragraph>
        These are the terms you agree to by using Sorrel. They are written to
        be read, not to be impenetrable.
      </Paragraph>

      <Section heading="Identification is a best guess">
        <Paragraph>
          Sorrel tells you how confident it is, and says so plainly when it
          does not know. That honesty is the point of the app — but it also
          means an identification is an estimate, not a determination.
        </Paragraph>

        <Highlight>
          Never eat, brew, apply to skin, or give to an animal any plant on the
          strength of an app identification alone. Confirm with an expert
          first. Some edible plants have lookalikes that will seriously harm
          you.
        </Highlight>
      </Section>

      <Section heading="Toxicity and plant health">
        <Paragraph>
          Toxicity information is general guidance to help you decide where to
          keep a plant. It is not veterinary or medical advice.
        </Paragraph>
        <Paragraph>
          If a person or an animal has eaten part of a plant, contact a doctor,
          a vet, or your national poison service straight away. Do not wait on
          anything this app says.
        </Paragraph>
        <Paragraph>
          Care and diagnosis notes are guidance, not a plant pathology lab. We
          try hard to get them right and we tell you when a note applies to the
          genus rather than your exact species, but plants die for reasons no
          app can see.
        </Paragraph>
      </Section>

      <Section heading="Your account and your content">
        <Paragraph>
          Your photos and notes remain yours. We do not claim ownership of
          them and we do not use them for anything beyond identifying the
          plant you asked about.
        </Paragraph>
        <Paragraph>
          Do not use Sorrel to upload anything unlawful, or anything you do not
          have the right to upload.
        </Paragraph>
      </Section>

      <Section heading="Free use and subscriptions">
        <Bullet>
          The free tier includes a set number of identifications each day. The
          count resets at midnight, and the app tells you when.
        </Bullet>
        <Bullet>
          A failed identification does not use up one of your scans. If we
          cannot answer, you are not charged for it.
        </Bullet>
        <Bullet>
          Paid subscriptions renew automatically until cancelled. The price and
          renewal date are shown before you are charged, never in a footnote.
        </Bullet>
        <Bullet>
          Cancel any time in Settings, which takes you to Apple's subscription
          page. We do not make you email us to cancel.
        </Bullet>
        <Paragraph>
          Subscriptions are billed by Apple. Refunds are handled by Apple under
          their policy, not by us — but email us anyway and we will help you
          chase it.
        </Paragraph>
      </Section>

      <Section heading="When things break">
        <Paragraph>
          Sorrel is provided as it is. We cannot promise it will always be
          available, or always be right. To the extent the law allows, we are
          not liable for loss arising from using it — including plants that die
          after following its advice.
        </Paragraph>
        <Paragraph>
          Nothing here removes rights you have under consumer law in your
          country. If a term conflicts with those rights, those rights win.
        </Paragraph>
      </Section>

      <Section heading="Ending it">
        <Paragraph>
          You can stop using Sorrel and delete everything we hold at any time
          from Settings. We may suspend an account that is being used to abuse
          the service or break these terms, and we will tell you why.
        </Paragraph>
      </Section>
    </LegalPage>
  );
}
