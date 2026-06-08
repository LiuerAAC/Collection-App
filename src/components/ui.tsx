import React, { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({ label, onPress, tone = "primary" }: { label: string; onPress: () => void; tone?: "primary" | "quiet" | "danger" }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, tone === "quiet" && styles.buttonQuiet, tone === "danger" && styles.buttonDanger]}>
      <Text style={[styles.buttonText, tone === "quiet" && styles.buttonQuietText]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={styles.input}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg
  },
  section: {
    marginBottom: spacing.lg
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  buttonQuiet: {
    backgroundColor: colors.accentSoft
  },
  buttonDanger: {
    backgroundColor: colors.red
  },
  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "700"
  },
  buttonQuietText: {
    color: colors.accent
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    marginRight: spacing.sm
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  chipTextActive: {
    color: colors.accent
  },
  field: {
    marginBottom: spacing.md
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  stat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs
  }
});

