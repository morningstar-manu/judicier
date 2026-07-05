import React, { useState } from "react";
import { Alert } from "react-native";
import { api } from "../api/client";
import { Btn, Card, Field, Hint, Screen } from "../components/ui";

export default function VisiteurScreen() {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [pieceId, setPieceId] = useState("");
  const [motif, setMotif] = useState("Visite");
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!nom.trim() || !prenom.trim()) {
      Alert.alert("Champs requis", "Nom et prénom obligatoires.");
      return;
    }
    setBusy(true);
    try {
      await api.createVisiteur({ nom, prenom, pieceId, motif, service });
      Alert.alert("Enregistré", `${prenom} ${nom} ajouté au registre visiteurs.`);
      setNom("");
      setPrenom("");
      setPieceId("");
      setMotif("Visite");
      setService("");
    } catch (e) {
      Alert.alert("Erreur", e.message || "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Hint>Enregistrez rapidement un visiteur sur le terrain. Un badge QR pourra être émis depuis GestiPers web.</Hint>

      <Card>
        <Field label="Nom" required value={nom} onChangeText={setNom} placeholder="NOM" autoCapitalize="characters" />
        <Field label="Prénom" required value={prenom} onChangeText={setPrenom} placeholder="Prénom" />
        <Field label="N° pièce d'identité" value={pieceId} onChangeText={setPieceId} autoCapitalize="characters" placeholder="CNI ou passeport" />
        <Field label="Motif de visite" value={motif} onChangeText={setMotif} placeholder="Visite, audience…" />
        <Field label="Service visité" value={service} onChangeText={setService} placeholder="Cabinet, protocole…" />
      </Card>

      <Btn title="Enregistrer le visiteur" onPress={submit} loading={busy} />
    </Screen>
  );
}
