import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ScanQRScreen from "./src/screens/ScanQRScreen";
import VerifyIdScreen from "./src/screens/VerifyIdScreen";
import VisiteurScreen from "./src/screens/VisiteurScreen";
import BagageScreen from "./src/screens/BagageScreen";
import { C, navTheme } from "./src/theme";

const Stack = createNativeStackNavigator();

const navColors = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: C.teal,
    background: C.bg,
    card: C.ink,
    text: C.ink,
    border: C.line,
  },
};

function AppNav() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navColors}>
      <Stack.Navigator screenOptions={navTheme}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ScanQR" component={ScanQRScreen} options={{ title: "Scan QR" }} />
            <Stack.Screen name="VerifyId" component={VerifyIdScreen} options={{ title: "Pièce d'identité" }} />
            <Stack.Screen name="Visiteur" component={VisiteurScreen} options={{ title: "Visiteur" }} />
            <Stack.Screen name="Bagage" component={BagageScreen} options={{ title: "Contrôle bagage" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
