import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { Btn, Card, ErrorText, Field, FlagBand } from "../components/ui";
import { C, S } from "../theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError("");
    setBusy(true);
    try {
      await login(identifiant.trim(), motDePasse);
    } catch (e) {
      setError(e.message || "Connexion impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[C.ink, "#0F1820", C.bg]} style={styles.wrap}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.brand}>
          <FlagBand height={5} />
          <Text style={styles.org}>République Centrafricaine</Text>
          <Text style={styles.appName}>GestiPers</Text>
          <Text style={styles.appSub}>Application terrain</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Connexion agent</Text>
          <Text style={styles.cardSub}>
            Scan QR, pièces d'identité et contrôles d'accès
          </Text>

          <Field
            label="Identifiant"
            autoCapitalize="none"
            value={identifiant}
            onChangeText={setIdentifiant}
            placeholder="Votre identifiant"
          />
          <Field
            label="Mot de passe"
            secureTextEntry
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="••••••••"
            onSubmitEditing={onSubmit}
          />

          <ErrorText>{error}</ErrorText>
          <Btn title="Se connecter" onPress={onSubmit} loading={busy} />
        </Card>

        <Text style={styles.footer}>Présidence de la République · Bangui</Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", padding: S.lg },
  brand: { alignItems: "center", marginBottom: S.xl },
  org: { color: "rgba(255,255,255,0.65)", fontSize: 11, letterSpacing: 2, marginTop: S.md, textTransform: "uppercase" },
  appName: { color: C.white, fontSize: 36, fontWeight: "800", marginTop: S.sm, letterSpacing: 1 },
  appSub: { color: C.tealMuted, fontSize: 15, marginTop: 4, fontWeight: "600" },
  card: { marginBottom: 0 },
  cardTitle: { fontSize: 22, fontWeight: "800", color: C.ink },
  cardSub: { fontSize: 14, color: C.muted, marginTop: 6, marginBottom: S.md, lineHeight: 20 },
  footer: { textAlign: "center", color: C.muted, fontSize: 12, marginTop: S.lg },
});
