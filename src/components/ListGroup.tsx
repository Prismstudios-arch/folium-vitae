import React, { Children, cloneElement, isValidElement, ReactElement, ReactNode } from "react";
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle, Switch } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { Colors, Radius, Spacing, Tiles, Typography } from "@constants/theme";
import { Icon } from "./Icon";

/**
 * iOS inset-grouped lists: white rounded groups on the grey ground, rows with
 * a coloured icon tile, hairline separators inset past the icon.
 *
 * Settings was built from big grey boxes and 22pt section headings. This is
 * the pattern people already know from Apple's own Settings, which is what
 * makes an app feel native rather than home-made.
 */

export function ListGroup({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<ListRowProps>[];

  return (
    <View style={[styles.group, style]}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.card}>
        {rows.map((row, index) =>
          cloneElement(row, { isLast: index === rows.length - 1, key: row.key ?? index })
        )}
      </View>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

export function IconTile({ icon, color = Tiles.green, size = 30 }: { icon: SFSymbol; color?: string; size?: number }) {
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: color, width: size, height: size, borderRadius: size * 0.27 },
      ]}
    >
      <Icon name={icon} size={size * 0.56} color="#FFFFFF" weight="semibold" />
    </View>
  );
}

export interface ListRowProps {
  icon?: SFSymbol;
  tint?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Right-hand control. Defaults to a chevron when the row opens something. */
  accessory?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  /** Injected by ListGroup. */
  isLast?: boolean;
}

export function ListRow({
  icon,
  tint,
  title,
  subtitle,
  value,
  onPress,
  onLongPress,
  accessory,
  destructive = false,
  disabled = false,
  isLast = false,
}: ListRowProps) {
  const trailing =
    accessory !== undefined ? (
      accessory
    ) : onPress ? (
      <Icon name="chevron.right" size={13} color={Colors.textDisabled} weight="semibold" />
    ) : null;

  const content = (
    <>
      {icon ? <IconTile icon={icon} color={destructive ? Tiles.red : tint} /> : null}
      <View style={[styles.rowBody, !isLast && styles.rowDivider]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, destructive && styles.rowTitleDestructive]}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {trailing}
      </View>
    </>
  );

  if (!onPress && !onLongPress) {
    return <View style={[styles.row, disabled && styles.rowDisabled]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={onLongPress && !onPress ? "Press and hold for options" : undefined}
    >
      {content}
    </Pressable>
  );
}

// `value` on a plain row is a text value; on a switch row it's the switch.
export interface ListSwitchRowProps extends Omit<ListRowProps, "accessory" | "onPress" | "onLongPress" | "value"> {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** A row whose trailing control is a switch. */
export function ListSwitchRow(props: ListSwitchRowProps) {
  const { value, onValueChange, disabled, ...row } = props;

  return (
    <ListRow
      {...row}
      disabled={disabled}
      accessory={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: Colors.separator, true: Colors.brand }}
          ios_backgroundColor={Colors.separator}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: Spacing.default,
    marginBottom: Spacing.loose,
  },
  groupTitle: {
    ...Typography.overline,
    color: Colors.textSecondary,
    marginLeft: Spacing.default,
    marginBottom: Spacing.tight,
  },
  groupFooter: {
    ...Typography.caption2,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.default,
    marginTop: Spacing.tight,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md + 2,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.default,
    gap: Spacing.default - 4,
    minHeight: 52,
    backgroundColor: Colors.card,
  },
  rowPressed: {
    backgroundColor: "#EEF1EF",
  },
  rowDisabled: {
    opacity: 0.5,
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.tight,
    paddingVertical: 11,
    paddingRight: Spacing.default,
    alignSelf: "stretch",
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  rowText: {
    flex: 1,
    justifyContent: "center",
  },
  rowTitle: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  rowTitleDestructive: {
    color: Colors.error,
  },
  rowSubtitle: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  rowValue: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
  },
});
