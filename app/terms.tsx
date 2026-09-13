import { LegalDocumentView } from "@components/LegalText";
import { TERMS_OF_USE } from "@content/legal";

export default function TermsScreen() {
  return <LegalDocumentView document={TERMS_OF_USE} />;
}
