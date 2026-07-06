import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "../api/client";
import { C, R, S, shadow } from "../theme";

const KIND_LABELS = { PR: "Personnel", PS: "Prestataire", VI: "Visiteur" };

function normalizeScanData(data) {
  const raw = String(data || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("gestipers://")) {
    return raw.replace(/^gestipers:\/\//i, "https://gestipers.local/");
  }
  return raw;
}

// Miroir de extractVerifyFields (packages/shared/verify.mjs) pour l'affichage
// du matricule — gère le format URL `?m=` ainsi que l'ancien format
// pipe-délimité `GESTIPERS|matricule|...` (avec ou sans encodage %7C).
function extractMatricule(rawInput) {
  let raw = String(rawInput || "").trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/?")) {
      const url = raw.startsWith("/?") ? new URL(raw, "https://gestipers.local") : new URL(raw);
      const m = url.searchParams.get("m");
      if (m) return m.toUpperCase();
    }
  } catch {
    /* ignore */
  }
  if (/%7C/i.test(raw)) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* ignore */
    }
  }
  if (raw.includes("|")) {
    const parts = raw.split("|");
    if (parts[0] === "GESTIPERS") return (parts[1] || "").toUpperCase();
  }
  return "";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function initials(prenom, nom) {
  const p = (prenom || "").trim()[0] || "";
  const n = (nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "?";
}

function resultTheme(result) {
  if (!result?.ok) {
    return {
      accent: C.red,
      soft: "#FDECEA",
      icon: "✕",
      title: "Vérification échouée",
    };
  }
  if (result.expiree) {
    return {
      accent: C.amber,
      soft: "#FEF6E8",
      icon: "⚠",
      title: result.msg || "Carte expirée",
    };
  }
  return {
    accent: C.green,
    soft: "#E8F5EC",
    icon: "✓",
    title: result.msg || "Document authentique",
  };
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ScanResult({ result, matricule, onRescan }) {
  const theme = resultTheme(result);
  const person = result.person;
  const subtitle = person
    ? [person.prenom, person.nom].filter(Boolean).join(" ")
  : null;

  return (
    <ScrollView style={styles.resultWrap} contentContainerStyle={styles.resultContent}>
      <View style={[styles.statusBanner, { backgroundColor: theme.accent }]}>
        <View style={[styles.statusIconRing, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Text style={styles.statusIcon}>{theme.icon}</Text>
        </View>
        <Text style={styles.statusTitle}>{theme.title}</Text>
        {!result.ok && result.msg ? (
          <Text style={styles.statusMsg}>{result.msg}</Text>
        ) : null}
      </View>

      <View style={styles.resultCard}>
        {person ? (
          <>
            <View style={styles.personHeader}>
              <View style={[styles.avatar, { backgroundColor: theme.soft }]}>
                <Text style={[styles.avatarText, { color: theme.accent }]}>
                  {initials(person.prenom, person.nom)}
                </Text>
              </View>
              <View style={styles.personMeta}>
                <Text style={styles.personName}>{subtitle}</Text>
                {result.label || KIND_LABELS[result.kind] ? (
                  <View style={[styles.kindBadge, { backgroundColor: C.tealSoft }]}>
                    <Text style={styles.kindBadgeText}>
                      {result.label || KIND_LABELS[result.kind] || "Carte"}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

            <DetailRow label="Matricule" value={matricule || person.id?.toUpperCase()} />
            <DetailRow label="Poste" value={person.poste} />
            <DetailRow label="Fonction" value={person.fonction} />
            <DetailRow label="Société" value={person.societe} />
            <DetailRow label="Motif" value={person.motif} />
            <DetailRow label="Catégorie" value={person.categorie} />
            {result.validite != null || person.carteValidite ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Validité</Text>
                <Text
                  style={[
                    styles.detailValue,
                    result.expiree && { color: C.red, fontWeight: "700" },
                  ]}
                >
                  {result.expiree
                    ? `Expirée le ${fmtDate(result.validite || person.carteValidite)}`
                    : `Jusqu'au ${fmtDate(result.validite || person.carteValidite)}`}
                </Text>
              </View>
            ) : null}
          </>
        ) : result.mission ? (
          <>
            <Text style={styles.docType}>Ordre de mission</Text>
            <DetailRow label="Objet" value={result.mission.objet} />
            <DetailRow label="Destination" value={result.mission.destination} />
            {subtitle ? <DetailRow label="Agent" value={subtitle} /> : null}
          </>
        ) : result.conge ? (
          <>
            <Text style={styles.docType}>Décision de congé</Text>
            <DetailRow label="Type" value={result.conge.type} />
            <DetailRow
              label="Période"
              value={`${fmtDate(result.conge.debut)} → ${fmtDate(result.conge.fin)}`}
            />
            {subtitle ? <DetailRow label="Agent" value={subtitle} /> : null}
          </>
        ) : result.decret ? (
          <>
            <Text style={styles.docType}>Décret</Text>
            <DetailRow label="Numéro" value={result.decret.numero} />
            <DetailRow label="Objet" value={result.decret.objet} />
            <DetailRow label="Date" value={fmtDate(result.decret.date)} />
          </>
        ) : !result.ok ? (
          <Text style={styles.errorHint}>
            Vérifiez que la carte a été émise dans GestiPers et que le QR est net et bien éclairé.
          </Text>
        ) : null}

        {result.ok && !result.expiree ? (
          <View style={[styles.validStamp, { borderColor: theme.accent, backgroundColor: theme.soft }]}>
            <Text style={[styles.validStampText, { color: theme.accent }]}>
              AUTHENTIFIÉ · GESTIPERS
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable style={styles.primaryBtn} onPress={onRescan}>
        <Text style={styles.primaryBtnText}>Scanner une autre carte</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function ScanQRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState("scan");
  const [manual, setManual] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastMatricule, setLastMatricule] = useState("");
  const lockRef = useRef(false);

  const resetScan = useCallback(() => {
    lockRef.current = false;
    setPhase("scan");
    setResult(null);
    setError("");
    setLastMatricule("");
  }, []);

  const verify = async (raw, authCode = "") => {
    const normalized = normalizeScanData(raw);
    if (!normalized) {
      setError("QR illisible — cadrez le code sur la carte ou saisissez le matricule.");
      setPhase("scan");
      lockRef.current = false;
      return;
    }
    setBusy(true);
    setError("");
    setLastMatricule(extractMatricule(normalized));
    try {
      const r = await api.verifyCard(normalized, authCode);
      setResult(r);
      setPhase("result");
    } catch (e) {
      setResult({ ok: false, msg: e.message || "Vérification échouée" });
      setPhase("result");
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const onBarcode = ({ data }) => {
    if (phase !== "scan" || busy || lockRef.current) return;
    if (!data || !String(data).trim()) return;
    lockRef.current = true;
    verify(data);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Accès caméra requis pour scanner les QR codes.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Autoriser la caméra</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "result" && result) {
    return (
      <ScanResult
        result={result}
        matricule={lastMatricule}
        onRescan={resetScan}
      />
    );
  }

  if (phase === "manual") {
    return (
      <View style={styles.wrap}>
        <ScrollView style={styles.manualBox} contentContainerStyle={styles.manualContent}>
          <Text style={styles.manualTitle}>Saisie manuelle</Text>
          <Text style={styles.manualHint}>
            Entrez le matricule inscrit sur la carte ou collez le lien scanné.
          </Text>
          <Text style={styles.label}>Matricule ou lien</Text>
          <TextInput
            style={styles.input}
            value={manual}
            onChangeText={setManual}
            placeholder="PR-… ou https://www.gestipers.org/?m=…"
            autoCapitalize="characters"
          />
          <Text style={styles.label}>Code auth (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="8 caractères sous le QR"
          />
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Pressable
            style={[styles.btn, (!manual.trim() || busy) && styles.btnDisabled]}
            onPress={() => verify(manual, code)}
            disabled={busy || !manual.trim()}
          >
            <Text style={styles.btnText}>{busy ? "Vérification…" : "Vérifier"}</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => { setError(""); setPhase("scan"); }}>
            <Text style={styles.linkBtnText}>← Retour au scan</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcode}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayMid}>
            <View style={styles.overlaySide} />
            <View style={styles.target}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.hint}>
              Cadrez le QR au recto de la carte GestiPers
            </Text>
          </View>
        </View>
        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.busyText}>Vérification en cours…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Pressable style={styles.secondary} onPress={() => setPhase("manual")}>
          <Text style={styles.secondaryText}>Saisie manuelle</Text>
        </Pressable>
      </View>
    </View>
  );
}

const CORNER = 22;
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.ink },
  cameraWrap: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  overlayMid: { flexDirection: "row", height: 240 },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  target: { width: 240, height: 240, position: "relative" },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: C.teal,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingTop: 20,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  hint: { color: "#fff", textAlign: "center", fontSize: 15, lineHeight: 22 },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14,124,123,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  busyText: { color: "#fff", marginTop: 14, fontSize: 16, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: C.bg },
  msg: { textAlign: "center", color: C.muted, marginBottom: 16, fontSize: 15 },
  manualBox: { flex: 1, backgroundColor: C.bg },
  manualContent: { padding: 20, paddingBottom: 40 },
  manualTitle: { fontSize: 22, fontWeight: "700", color: C.ink, marginBottom: 6 },
  manualHint: { fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 13, color: C.muted, marginBottom: 6, marginTop: 10, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    backgroundColor: C.card,
    fontSize: 16,
    color: C.ink,
  },
  panel: {
    backgroundColor: C.card,
    paddingVertical: 14,
    paddingHorizontal: S.md,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    ...shadow.soft,
  },
  err: { color: C.red, marginBottom: 8, fontSize: 14, lineHeight: 20 },
  btn: {
    marginTop: 20,
    backgroundColor: C.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 16, alignItems: "center", paddingVertical: 8 },
  linkBtnText: { color: C.teal, fontWeight: "600", fontSize: 15 },
  secondary: { alignItems: "center", paddingVertical: 6 },
  secondaryText: { color: C.teal, fontWeight: "600", fontSize: 15 },

  resultWrap: { flex: 1, backgroundColor: C.bg },
  resultContent: { paddingBottom: S.xl },
  statusBanner: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: S.lg,
    alignItems: "center",
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
  },
  statusIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  statusIcon: { fontSize: 36, color: "#fff", fontWeight: "700" },
  statusTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  statusMsg: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  resultCard: {
    marginHorizontal: S.md,
    marginTop: -18,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 20,
    ...shadow.card,
  },
  personHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "800" },
  personMeta: { flex: 1 },
  personName: { fontSize: 20, fontWeight: "700", color: C.ink, marginBottom: 6 },
  kindBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  kindBadgeText: { fontSize: 12, fontWeight: "700", color: C.teal },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 16 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: C.muted, flex: 1 },
  detailValue: {
    fontSize: 14,
    color: C.ink,
    fontWeight: "600",
    flex: 1.2,
    textAlign: "right",
  },
  docType: {
    fontSize: 18,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: C.muted,
    lineHeight: 21,
    textAlign: "center",
    paddingVertical: 8,
  },
  validStamp: {
    marginTop: 18,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  validStampText: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  primaryBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: C.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
