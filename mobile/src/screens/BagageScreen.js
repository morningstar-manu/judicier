import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api/client";
import { Btn, Card, ChipRow, Field, Hint, OutlineBtn, Screen } from "../components/ui";
import { C, R, S } from "../theme";

const STATUTS = ["Conforme", "À inspecter", "Refusé"];
const STATUT_COLORS = { Conforme: C.green, "À inspecter": C.amber, Refusé: C.red };

export default function BagageScreen() {
  const [lieu, setLieu] = useState("");
  const [typeObjet, setTypeObjet] = useState("Valise");
  const [statut, setStatut] = useState("Conforme");
  const [notes, setNotes] = useState("");
  const [photoId, setPhotoId] = useState("");
  const [busy, setBusy] = useState(false);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (!shot.canceled && shot.assets?.[0]?.base64) {
      try {
        const up = await api.uploadScan(
          `data:image/jpeg;base64,${shot.assets[0].base64}`,
          "bagage.jpg"
        );
        setPhotoId(up.id);
        Alert.alert("Photo", "Scan du bagage enregistré.");
      } catch (e) {
        Alert.alert("Erreur", e.message);
      }
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.createBagage({ lieu, typeObjet, statut, notes, photoId });
      Alert.alert("Contrôle enregistré", `${typeObjet} — ${statut}`);
      setLieu("");
      setTypeObjet("Valise");
      setStatut("Conforme");
      setNotes("");
      setPhotoId("");
    } catch (e) {
      Alert.alert("Erreur", e.message || "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Hint>Registre des contrôles bagages et colis. Joignez une photo si nécessaire.</Hint>

      <Card>
        <Field label="Lieu du contrôle" value={lieu} onChangeText={setLieu} placeholder="Entrée principale, parking…" />
        <Field label="Type d'objet" value={typeObjet} onChangeText={setTypeObjet} placeholder="Valise, sac, carton…" />

        <Text style={styles.statutLabel}>Statut</Text>
        <ChipRow
          options={STATUTS}
          value={statut}
          onChange={setStatut}
          color={STATUT_COLORS[statut]}
        />

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder="Observations, anomalies…"
          style={{ marginTop: S.sm }}
        />
      </Card>

      <OutlineBtn
        title={photoId ? "📷 Photo jointe — reprendre" : "📷 Photographier le bagage"}
        onPress={takePhoto}
      />

      <Btn title="Enregistrer le contrôle" onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statutLabel: { fontSize: 13, fontWeight: "600", color: C.inkSoft, marginBottom: 8, marginTop: 4 },
});
