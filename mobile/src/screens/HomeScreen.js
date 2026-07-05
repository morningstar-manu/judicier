import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { ActionTile, FlagBand, Screen, SectionTitle } from "../components/ui";
import { C, R, S } from "../theme";

const tiles = [
  { route: "ScanQR", title: "Scanner QR", desc: "Vérifier une carte authentifiée", emoji: "📷", accent: C.teal },
  { route: "VerifyId", title: "Pièce d'identité", desc: "CNI / passeport · registres", emoji: "🪪", accent: "#3D6B8E" },
  { route: "Visiteur", title: "Visiteur", desc: "Enregistrement accueil rapide", emoji: "👤", accent: "#6B5B95" },
  { route: "Bagage", title: "Contrôle bagage", desc: "Inspection et statut", emoji: "🧳", accent: C.amber },
];

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const initial = (user?.nom || user?.identifiant || "?")[0].toUpperCase();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <LinearGradient colors={[C.ink, "#243442"]} style={styles.header}>
        <FlagBand height={4} />
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.greeting}>Bonjour</Text>
            <Text style={styles.name}>{user?.nom || user?.identifiant}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.role}>{user?.role}</Text>
            </View>
          </View>
          <Pressable onPress={logout} style={styles.logout}>
            <Text style={styles.logoutText}>Sortir</Text>
          </Pressable>
        </View>
        <Text style={styles.headerTag}>GestiPers Terrain</Text>
      </LinearGradient>

      <Screen scroll pad={false}>
        <View style={styles.body}>
          <SectionTitle>Actions terrain</SectionTitle>
          {tiles.map((t) => (
            <ActionTile
              key={t.route}
              emoji={t.emoji}
              title={t.title}
              desc={t.desc}
              accent={t.accent}
              onPress={() => navigation.navigate(t.route)}
            />
          ))}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingBottom: S.lg,
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", padding: S.md, paddingTop: S.md, gap: S.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.white, fontSize: 22, fontWeight: "800" },
  headerMeta: { flex: 1 },
  greeting: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  name: { color: C.white, fontSize: 20, fontWeight: "800", marginTop: 2 },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: R.full,
    marginTop: 6,
  },
  role: { color: C.tealMuted, fontSize: 12, fontWeight: "700" },
  logout: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.full,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  logoutText: { color: "#F5A8A4", fontSize: 12, fontWeight: "700" },
  headerTag: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingHorizontal: S.md,
    fontWeight: "600",
  },
  body: { padding: S.md, paddingTop: S.lg },
});
