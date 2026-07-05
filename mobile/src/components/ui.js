import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, FLAG, R, S, shadow } from "../theme";

export function FlagBand({ height = 4 }) {
  return (
    <View style={[styles.flagRow, { height }]}>
      {FLAG.map((color) => (
        <View key={color} style={[styles.flagSeg, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function Screen({ children, scroll = true, pad = true }) {
  const content = <View style={[pad && styles.screenPad]}>{children}</View>;
  if (!scroll) {
    return <View style={styles.screen}>{content}</View>;
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[pad && styles.screenPad, styles.screenBottom]}>
      {children}
    </ScrollView>
  );
}

export function HeroHeader({ title, subtitle, children }) {
  return (
    <LinearGradient colors={[C.ink, "#1E2D3D"]} style={styles.hero}>
      <FlagBand />
      <View style={styles.heroBody}>
        {title ? <Text style={styles.heroTitle}>{title}</Text> : null}
        {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
        {children}
      </View>
    </LinearGradient>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Hint({ children }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function Label({ children, required }) {
  return (
    <Text style={styles.label}>
      {children}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

export function Field({ label, required, ...props }) {
  return (
    <View style={styles.field}>
      {label ? <Label required={required}>{label}</Label> : null}
      <TextInput
        style={[styles.input, props.multiline && styles.inputMulti]}
        placeholderTextColor={C.muted}
        {...props}
      />
    </View>
  );
}

export function Btn({ title, onPress, disabled, loading, variant = "primary", style }) {
  const v = variants[variant] || variants.primary;
  return (
    <Pressable
      style={[styles.btn, v.btn, disabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <Text style={[styles.btnText, v.text]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function OutlineBtn({ title, onPress, disabled, style }) {
  return (
    <Pressable style={[styles.outlineBtn, disabled && styles.btnDisabled, style]} onPress={onPress} disabled={disabled}>
      <Text style={styles.outlineBtnText}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color = C.teal }) {
  return (
    <Pressable
      style={[
        styles.chip,
        active && { backgroundColor: `${color}18`, borderColor: color },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && { color, fontWeight: "700" }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ options, value, onChange, color }) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <Chip key={o} label={o} active={value === o} onPress={() => onChange(o)} color={color} />
      ))}
    </View>
  );
}

export function ActionTile({ emoji, title, desc, onPress, accent = C.teal }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={[styles.tileIcon, { backgroundColor: `${accent}18` }]}>
        <Text style={styles.tileEmoji}>{emoji}</Text>
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileDesc}>{desc}</Text>
      </View>
      <Text style={styles.tileChevron}>›</Text>
    </Pressable>
  );
}

export function ResultCard({ title, badge, badgeColor, message, children, borderColor }) {
  return (
    <Card style={[styles.resultCard, borderColor && { borderLeftWidth: 4, borderLeftColor: borderColor }]}>
      {title ? <Text style={styles.resultSection}>{title}</Text> : null}
      {badge ? (
        <Text style={[styles.resultBadge, { color: badgeColor || C.ink }]}>{badge}</Text>
      ) : null}
      {message ? <Text style={styles.resultMsg}>{message}</Text> : null}
      {children}
    </Card>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const variants = {
  primary: { btn: { backgroundColor: C.teal }, text: { color: C.white }, spinner: "#fff" },
  danger: { btn: { backgroundColor: C.red }, text: { color: C.white }, spinner: "#fff" },
  ghost: { btn: { backgroundColor: "transparent" }, text: { color: C.teal }, spinner: C.teal },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  screenPad: { padding: S.md },
  screenBottom: { paddingBottom: S.xl },
  flagRow: { flexDirection: "row", width: "100%" },
  flagSeg: { flex: 1 },
  hero: { marginHorizontal: -S.md, marginTop: -S.md, marginBottom: S.md, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl, overflow: "hidden" },
  heroBody: { padding: S.lg, paddingTop: S.md },
  heroTitle: { color: C.white, fontSize: 26, fontWeight: "800", letterSpacing: 0.3 },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 6, lineHeight: 20 },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.md,
    ...shadow.card,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: S.sm,
    marginTop: S.sm,
  },
  hint: { fontSize: 14, color: C.muted, lineHeight: 21, marginBottom: S.md },
  label: { fontSize: 13, fontWeight: "600", color: C.inkSoft, marginBottom: 6 },
  required: { color: C.red },
  field: { marginBottom: S.sm },
  input: {
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: C.ink,
    backgroundColor: C.card,
  },
  inputMulti: { minHeight: 88, textAlignVertical: "top" },
  btn: {
    borderRadius: R.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: S.md,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontWeight: "700", fontSize: 16 },
  outlineBtn: {
    borderRadius: R.md,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.teal,
    backgroundColor: C.tealSoft,
    marginTop: S.sm,
  },
  outlineBtnText: { color: C.teal, fontWeight: "700", fontSize: 15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: R.full,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  chipText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.sm,
    ...shadow.soft,
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: S.md,
  },
  tileEmoji: { fontSize: 26 },
  tileBody: { flex: 1 },
  tileTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  tileDesc: { fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 18 },
  tileChevron: { fontSize: 26, color: C.tealMuted, fontWeight: "300", marginLeft: 4 },
  resultCard: { marginTop: S.md },
  resultSection: { fontSize: 11, fontWeight: "800", color: C.teal, letterSpacing: 0.8, marginBottom: 4 },
  resultBadge: { fontSize: 18, fontWeight: "800" },
  resultMsg: { marginTop: S.sm, fontSize: 14, color: C.inkSoft, lineHeight: 21 },
  error: { color: C.red, fontSize: 14, marginTop: S.sm, lineHeight: 20 },
});
