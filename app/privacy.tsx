import { LegalDocumentView } from "@components/LegalText";
import { PRIVACY_POLICY } from "@content/legal";

export default function PrivacyScreen() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
