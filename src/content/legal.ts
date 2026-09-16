/**
 * Legal copy, as data.
 *
 * Single source for both the in-app screens and the public web pages that
 * App Store Connect requires. App review compares the two; keeping one copy
 * and rendering it twice is what stops them drifting.
 *
 * DRAFT — both documents need review by a qualified lawyer before
 * submission.
 *
 * Every factual claim here describes what the code actually does. The EXIF
 * claim in particular is true only because capture.ts re-encodes each photo
 * before upload — if that changes, this text becomes false.
 */

import { SUPPORT_EMAIL } from "@constants/config";

export type Block =
  | { type: "p"; text: string }
  | { type: "bullet"; text: string }
  | { type: "highlight"; text: string };

export interface Section {
  heading: string;
  blocks: Block[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  intro: Block[];
  sections: Section[];
}

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Privacy",
  intro: [
    {
      type: "p",
      text: "Sorrel is built so that we hold as little about you as possible. This page says exactly what we collect, why, and who else sees it. No lawyer-speak.",
    },
    {
      type: "highlight",
      text: "You do not need an account to use Sorrel. We do not sell your data, we do not run ads, and we do not track your location.",
    },
  ],
  sections: [
    {
      heading: "Photos you scan",
      blocks: [
        {
          type: "p",
          text: "When you identify a plant, the photo is sent to our server, which passes it to our identification provider and returns the answer.",
        },
        {
          type: "p",
          text: "Before a photo leaves your phone we resize it and re-encode it, which removes the embedded metadata cameras attach — including the GPS coordinates of where it was taken. For houseplants that is usually your home, so we strip it rather than ask you to trust us with it.",
        },
        {
          type: "p",
          text: "We keep a fingerprint of each photo so that re-scanning the same plant returns the previous answer instantly, without using up one of your identifications.",
        },
      ],
    },
    {
      heading: "What we store about you",
      blocks: [
        {
          type: "bullet",
          text: "An identifier for your install. It is worked out on your device from the identifier iOS gives apps from the same developer, and what we receive is a one-way hash of it. It is not your Apple ID, not a hardware serial number, and cannot be used to follow you into anybody else's apps. It survives reinstalling, which is how the free allowance cannot be reset by deleting the app.",
        },
        {
          type: "bullet",
          text: "How many identifications you have used in the current seven-day window, so the free allowance works and cannot be reset by reinstalling.",
        },
        {
          type: "bullet",
          text: "No email address and no password. Sorrel has no sign-up: the only account is the anonymous one tied to the identifier above. That is also why your collection lives on this phone rather than on our servers — export it from Settings before you delete the app, because deleting the app deletes it.",
        },
      ],
    },
    {
      heading: "What stays on your phone",
      blocks: [
        {
          type: "p",
          text: "Your plant collection lives on your device, not our servers. That includes nicknames, the room you keep each plant in, your notes, your photo journal and your watering history. It works with no signal, and we cannot read it.",
        },
        {
          type: "p",
          text: "Your settings — units, hemisphere, toxicity warnings, reminders — are also stored locally.",
        },
      ],
    },
    {
      heading: "Who else sees anything",
      blocks: [
        {
          type: "bullet",
          text: "Our identification provider receives the photo in order to identify it. It does not receive your identifier, your collection, or anything else about you.",
        },
        {
          type: "bullet",
          text: "Our hosting providers store the database and run the server. They do not use the data for anything of their own.",
        },
        {
          type: "bullet",
          text: "If you subscribe, our payments provider handles the subscription. Card details go to Apple, never to us — we never see them.",
        },
        {
          type: "p",
          text: "That is the complete list. There are no advertising networks, no data brokers, and no third-party trackers in this app.",
        },
      ],
    },
    {
      heading: "Your data is yours",
      blocks: [
        {
          type: "p",
          text: "Settings has a button that exports everything we hold, and a button that deletes it. Deleting removes your plants and your account data. No email, no waiting, no support ticket.",
        },
      ],
    },
    {
      heading: "Children",
      blocks: [
        {
          type: "p",
          text: `Sorrel is not aimed at children under 13, and we do not knowingly collect anything from them. If you believe a child has given us information, email ${SUPPORT_EMAIL} and we will delete it.`,
        },
      ],
    },
    {
      heading: "Changes",
      blocks: [
        {
          type: "p",
          text: "If we change what we collect or who receives it, we will update this page and the date at the top, and tell you in the app before the change takes effect.",
        },
      ],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  slug: "terms",
  title: "Terms of use",
  intro: [
    {
      type: "p",
      text: "These are the terms you agree to by using Sorrel. They are written to be read, not to be impenetrable.",
    },
  ],
  sections: [
    {
      heading: "Identification is a best guess",
      blocks: [
        {
          type: "p",
          text: "Sorrel tells you how confident it is, and says so plainly when it does not know. That honesty is the point of the app — but it also means an identification is an estimate, not a determination.",
        },
        {
          type: "highlight",
          text: "Never eat, brew, apply to skin, or give to an animal any plant on the strength of an app identification alone. Confirm with an expert first. Some edible plants have lookalikes that will seriously harm you.",
        },
      ],
    },
    {
      heading: "Toxicity and plant health",
      blocks: [
        {
          type: "p",
          text: "Toxicity information is general guidance to help you decide where to keep a plant. It is not veterinary or medical advice.",
        },
        {
          type: "p",
          text: "If a person or an animal has eaten part of a plant, contact a doctor, a vet, or your national poison service straight away. Do not wait on anything this app says.",
        },
        {
          type: "p",
          text: "Care and diagnosis notes are guidance, not a plant pathology lab. We try hard to get them right, and we tell you when a note applies to the genus rather than your exact species, but plants die for reasons no app can see.",
        },
      ],
    },
    {
      heading: "Your account and your content",
      blocks: [
        {
          type: "p",
          text: "Your photos and notes remain yours. We do not claim ownership of them and we do not use them for anything beyond identifying the plant you asked about.",
        },
        {
          type: "p",
          text: "Do not use Sorrel to upload anything unlawful, or anything you do not have the right to upload.",
        },
      ],
    },
    {
      heading: "Free use and subscriptions",
      blocks: [
        {
          type: "bullet",
          text: "The free tier includes a set number of identifications every seven days, and more in your first week. The window starts when you make your first identification and the app shows how many you have left and when the next ones arrive.",
        },
        {
          type: "bullet",
          text: "A failed identification does not use up one of your scans. If we cannot answer, you are not charged for it.",
        },
        {
          type: "bullet",
          text: "Paid subscriptions renew automatically until cancelled. The price and renewal date are shown before you are charged, never in a footnote.",
        },
        {
          type: "bullet",
          text: "Cancel any time in Settings, which takes you to Apple's subscription page. We do not make you email us to cancel.",
        },
        {
          type: "p",
          text: "Subscriptions are billed by Apple. Refunds are handled by Apple under their policy, not by us — but email us anyway and we will help you chase it.",
        },
      ],
    },
    {
      heading: "When things break",
      blocks: [
        {
          type: "p",
          text: "Sorrel is provided as it is. We cannot promise it will always be available, or always be right. To the extent the law allows, we are not liable for loss arising from using it — including plants that die after following its advice.",
        },
        {
          type: "p",
          text: "Nothing here removes rights you have under consumer law in your country. If a term conflicts with those rights, those rights win.",
        },
      ],
    },
    {
      heading: "Ending it",
      blocks: [
        {
          type: "p",
          text: "You can stop using Sorrel and delete everything we hold at any time from Settings. We may suspend an account that is being used to abuse the service or break these terms, and we will tell you why.",
        },
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = [PRIVACY_POLICY, TERMS_OF_USE];
