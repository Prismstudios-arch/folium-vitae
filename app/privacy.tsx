import { LegalPage, Section, Paragraph, Bullet, Highlight } from "@components/LegalText";

/**
 * Privacy policy.
 *
 * DRAFT — needs review by a qualified lawyer before submission. Every factual
 * claim below matches what the code actually does today, and must be updated
 * alongside any change to what is collected or who receives it. In particular
 * the EXIF claim is true because capture.ts re-encodes every photo before
 * upload; if that is ever removed, this text becomes false.
 */
export default function PrivacyScreen() {
  return (
    <LegalPage title="Privacy">
      <Paragraph>
        Sorrel is built so that we hold as little about you as possible. This
        page says exactly what we collect, why, and who else sees it. No
        lawyer-speak.
      </Paragraph>

      <Highlight>
        You do not need an account to use Sorrel. We do not sell your data, we
        do not run ads, and we do not track your location.
      </Highlight>

      <Section heading="Photos you scan">
        <Paragraph>
          When you identify a plant, the photo is sent to our server, which
          passes it to our identification provider and returns the answer.
        </Paragraph>
        <Paragraph>
          Before a photo leaves your phone we resize it and re-encode it, which
          removes the embedded metadata cameras attach — including the GPS
          coordinates of where it was taken. For houseplants that is usually
          your home, so we strip it rather than ask you to trust us with it.
        </Paragraph>
        <Paragraph>
          We keep a fingerprint of each photo so that re-scanning the same
          plant returns the previous answer instantly without costing you one
          of your daily scans.
        </Paragraph>
      </Section>

      <Section heading="What we store about you">
        <Bullet>
          A random identifier for your install. It is generated on your device
          and is not tied to your phone's hardware, your Apple ID, or you.
        </Bullet>
        <Bullet>
          How many scans you have used today, so the daily limit works and
          cannot be reset by reinstalling.
        </Bullet>
        <Bullet>
          Your email address and an encrypted form of your password — only if
          you choose to create an account so your collection survives a new
          phone.
        </Bullet>
      </Section>

      <Section heading="What stays on your phone">
        <Paragraph>
          Your plant collection lives on your device, not our servers. That
          includes nicknames, the room you keep each plant in, your notes,
          your photo journal and your watering history. It works with no
          signal, and we cannot read it.
        </Paragraph>
        <Paragraph>
          Your settings — units, hemisphere, toxicity warnings, reminders —
          are also stored locally.
        </Paragraph>
      </Section>

      <Section heading="Who else sees anything">
        <Bullet>
          <>Our identification provider receives the photo in order to identify it. It does not receive your identifier, your collection, or anything else about you.</>
        </Bullet>
        <Bullet>
          <>Our hosting providers store the database and run the server. They do not use the data for anything of their own.</>
        </Bullet>
        <Bullet>
          <>If you subscribe, our payments provider handles the subscription. Card details go to Apple, never to us — we never see them.</>
        </Bullet>
        <Paragraph>
          That is the complete list. There are no advertising networks, no data
          brokers, and no third-party trackers in this app.
        </Paragraph>
      </Section>

      <Section heading="Your data is yours">
        <Paragraph>
          Settings has a button that exports everything we hold, and a button
          that deletes it. Deleting removes your plants and your account data.
          No email, no waiting, no support ticket.
        </Paragraph>
      </Section>

      <Section heading="Children">
        <Paragraph>
          Sorrel is not aimed at children under 13, and we do not knowingly
          collect anything from them. If you believe a child has given us
          information, email us and we will delete it.
        </Paragraph>
      </Section>

      <Section heading="Changes">
        <Paragraph>
          If we change what we collect or who receives it, we will update this
          page and the date at the top, and tell you in the app before the
          change takes effect.
        </Paragraph>
      </Section>
    </LegalPage>
  );
}
