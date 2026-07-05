export const C = {
  teal: "#0E7C7B",
  tealDark: "#0A5F5E",
  tealSoft: "#E3F1F0",
  tealMuted: "#B8D9D8",
  ink: "#182430",
  inkSoft: "#3C4A58",
  muted: "#5E6E7B",
  line: "#E3E8ED",
  bg: "#F0F3F6",
  card: "#FFFFFF",
  green: "#2E7D4F",
  greenSoft: "#E8F5EC",
  red: "#C4443C",
  redSoft: "#FDECEA",
  amber: "#E8A33D",
  amberSoft: "#FEF6E8",
  white: "#FFFFFF",
};

export const FLAG = ["#003082", "#FFFFFF", "#289728", "#FFCE00", "#CE1126"];

export const R = { sm: 10, md: 14, lg: 18, xl: 24, full: 999 };

export const S = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const shadow = {
  card: {
    shadowColor: "#182430",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  soft: {
    shadowColor: "#182430",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
};

export const niveauColor = {
  conforme: C.green,
  doute: C.amber,
  inconnu: C.amber,
  non_conforme: C.red,
  erreur: C.red,
};

export const niveauLabel = {
  conforme: "Conforme",
  doute: "Doute",
  inconnu: "Inconnu",
  non_conforme: "Non conforme",
  erreur: "Erreur",
};

export const navTheme = {
  headerStyle: { backgroundColor: C.ink },
  headerTintColor: C.white,
  headerTitleStyle: { fontWeight: "700", fontSize: 17 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: C.bg },
};
