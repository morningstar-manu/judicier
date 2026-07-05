import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api/client";
import { recognizeMrzFromImage } from "../lib/ocr";
import {
  Btn,
  Card,
  ChipRow,
  Field,
  Hint,
  OutlineBtn,
  ResultCard,
  Screen,
} from "../components/ui";
import { C, niveauColor, niveauLabel, S } from "../theme";

export default function VerifyIdScreen() {
  const [typePiece, setTypePiece] = useState("CNI");
  const [numero, setNumero] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [internal, setInternal] = useState(null);
  const [official, setOfficial] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState("");

  const applyMrz = (parsed) => {
    if (!parsed.ok) {
      setOcrMsg(parsed.msg || "MRZ non détecté");
      return;
    }
    setOcrMsg(`✓ MRZ ${parsed.format} lu avec succès`);
    if (parsed.typePiece) setTypePiece(parsed.typePiece);
    if (parsed.numero) setNumero(parsed.numero);
    if (parsed.nom) setNom(parsed.nom);
    if (parsed.prenom) setPrenom(parsed.prenom);
    if (parsed.dateNaissance) setDateNaissance(parsed.dateNaissance);
  };

  const scanDocument = async (fromGallery = false) => {
    const perm = fromGallery
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setOcrMsg("Autorisation caméra / galerie requise.");
      return;
    }
    setBusy(true);
    setOcrMsg("Analyse OCR en cours… (5–15 s)");
    try {
      const launch = fromGallery
        ? ImagePicker.launchImageLibraryAsync
        : ImagePicker.launchCameraAsync;
      const shot = await launch({ quality: 0.9, base64: true, allowsEditing: false });
      if (shot.canceled || !shot.assets?.[0]) {
        setOcrMsg("");
        return;
      }
      const asset = shot.assets[0];
      const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : "";
      if (dataUrl) {
        try {
          await api.uploadScan(dataUrl, "piece-id.jpg");
        } catch {
          /* non bloquant */
        }
      }
      const parsed = await recognizeMrzFromImage(asset.uri, dataUrl);
      applyMrz(parsed);
      if (!parsed.ok) {
        setOcrMsg(
          parsed.msg ||
            "MRZ non détecté — cadrez les lignes en bas de la pièce, sans reflet."
        );
      }
    } catch (e) {
      setOcrMsg(e.message || "OCR impossible — vérifiez la connexion à l'API.");
    } finally {
      setBusy(false);
    }
  };

  const runVerify = async () => {
    setBusy(true);
    setInternal(null);
    setOfficial(null);
    try {
      const r = await api.verifyId({
        typePiece,
        numero,
        nom,
        prenom,
        dateNaissance,
        official: Boolean(dateNaissance && nom && prenom),
      });
      setInternal(r.internal || r);
      setOfficial(r.official || null);
    } catch (e) {
      setInternal({ niveau: "erreur", msg: e.message, matches: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Hint>
        Photographiez la zone MRZ (lignes en bas du passeport ou verso CNI). L'OCR s'effectue via le serveur GestiPers.
      </Hint>

      <Card style={styles.scanCard}>
        <OutlineBtn
          title={busy ? "⏳ Analyse en cours…" : "📷 Photographier la zone MRZ"}
          onPress={() => scanDocument(false)}
          disabled={busy}
        />
        <Btn
          title="🖼 Choisir une photo"
          variant="ghost"
          onPress={() => scanDocument(true)}
          disabled={busy}
          style={styles.galleryBtn}
        />
        {ocrMsg ? (
          <Text style={[styles.ocrMsg, ocrMsg.startsWith("✓") && styles.ocrOk]}>{ocrMsg}</Text>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.typeLabel}>Type de pièce</Text>
        <ChipRow options={["CNI", "Passeport"]} value={typePiece} onChange={setTypePiece} />

        <Field
          label="Numéro de pièce"
          required
          value={numero}
          onChangeText={setNumero}
          autoCapitalize="characters"
          placeholder="Ex : AB123456"
        />
        <Field label="Nom" value={nom} onChangeText={setNom} autoCapitalize="characters" />
        <Field label="Prénom" value={prenom} onChangeText={setPrenom} />
        <Field
          label="Date de naissance"
          value={dateNaissance}
          onChangeText={setDateNaissance}
          placeholder="AAAA-MM-JJ (vérif. officielle)"
        />
      </Card>

      <Btn
        title="Lancer la vérification"
        onPress={runVerify}
        loading={busy}
        disabled={numero.trim().length < 4}
      />

      {internal && (
        <ResultCard
          title="Registres GestiPers"
          badge={niveauLabel[internal.niveau] || internal.niveau}
          badgeColor={niveauColor[internal.niveau]}
          message={internal.msg}
          borderColor={niveauColor[internal.niveau]}
        >
          {internal.matches?.map((m, i) => (
            <View key={i} style={styles.match}>
              <Text style={styles.matchSource}>{m.source}</Text>
              <Text style={styles.matchLabel}>{m.label}</Text>
              <Text style={styles.matchDetail}>{m.detail}</Text>
            </View>
          ))}
        </ResultCard>
      )}

      {official && (
        <ResultCard
          title="Vérification officielle (ONCA)"
          badge={official.ok ? "Conforme" : official.available ? "Non conforme" : "Indisponible"}
          badgeColor={official.ok ? C.green : official.available ? C.red : C.amber}
          message={
            !official.available
              ? official.error || "Service non configuré"
              : official.ok
                ? JSON.stringify(official.data, null, 2)
                : official.error || "Non conforme"
          }
          borderColor={official.ok ? C.green : C.amber}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scanCard: { paddingBottom: S.sm },
  galleryBtn: { marginTop: 0 },
  ocrMsg: { fontSize: 13, color: C.muted, marginTop: S.sm, textAlign: "center", lineHeight: 19 },
  ocrOk: { color: C.green, fontWeight: "600" },
  typeLabel: { fontSize: 13, fontWeight: "600", color: C.inkSoft, marginBottom: 8 },
  match: { marginTop: S.md, paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.line },
  matchSource: { fontSize: 11, color: C.teal, fontWeight: "800", letterSpacing: 0.5 },
  matchLabel: { fontSize: 15, fontWeight: "700", color: C.ink, marginTop: 4 },
  matchDetail: { fontSize: 13, color: C.muted, marginTop: 2 },
});
