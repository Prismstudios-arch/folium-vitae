import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Colors, Spacing, Typography } from "@constants/theme";
import { SUPPORT_EMAIL, LEGAL_LAST_UPDATED } from "@constants/config";
import { LegalDocument, Block } from "@content/legal";

/**
 * Renders a legal document from src/content/legal.ts.
 *
 * The same data drives the public web pages, so the in-app text and the URL
 * App Store Connect points at cannot drift apart.
 */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <LegalPage title={document.title}>
      {document.intro.map((block, index) => (
        <BlockView key={`intro-${index}`} block={block} />
      ))}

      {document.sections.map((section) => (
        <Section key={section.heading} heading={section.heading}>
          {section.blocks.map((block, index) => (
            <BlockView key={`${section.heading}-${index}`} block={block} />
          ))}
        </Section>
      ))}
    </LegalPage>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "bullet":
      return <Bullet>{block.text}</Bullet>;
    case "highlight":
      return <Highlight>{block.text}</Highlight>;
    default:
      return <Paragraph>{block.text}</Paragraph>;
  }
}

/** Page wrapper for the legal screens. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.updated}>Last updated {LEGAL_LAST_UPDATED}</Text>

      {children}

      <View style={styles.divider} />

      <Text style={styles.h2}>Contact</Text>
      <Paragraph>Questions about any of this go to a person, not a form:</Paragraph>

      <TouchableOpacity
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        accessibilityRole="link"
      >
        <Text style={styles.email}>{SUPPORT_EMAIL}</Text>
      </TouchableOpacity>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{heading}</Text>
      {children}
    </View>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

/** For the things we want people to actually notice. */
export function Highlight({ children }: { children: ReactNode }) {
  return (
    <View style={styles.highlight}>
      <Text style={styles.highlightText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.loose, paddingBottom: Spacing.extra },
  back: {
    ...Typography.button,
    color: Colors.leaf,
    marginBottom: Spacing.loose,
  },
  title: {
    ...Typography.display,
    color: Colors.textPrimary,
    marginBottom: Spacing.compact,
  },
  updated: {
    ...Typography.caption2,
    color: Colors.textSecondary,
    marginBottom: Spacing.loose,
  },
  section: { marginBottom: Spacing.loose },
  h2: {
    ...Typography.subheadline,
    color: Colors.textPrimary,
    marginBottom: Spacing.tight,
  },
  paragraph: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.tight,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: Spacing.compact,
    paddingRight: Spacing.tight,
  },
  bulletMark: {
    ...Typography.body,
    color: Colors.leaf,
    width: 18,
  },
  bulletText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
  highlight: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: Colors.leaf,
    borderRadius: 4,
    padding: Spacing.default,
    marginVertical: Spacing.tight,
  },
  highlightText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glass,
    marginVertical: Spacing.loose,
  },
  email: {
    ...Typography.bodyLarge,
    color: Colors.leaf,
    marginTop: Spacing.compact,
  },
  footerSpace: { height: Spacing.extra },
});
