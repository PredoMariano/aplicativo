import { useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { connectToBroker } from "../../services/mqtt";

export default function HomeScreen() {
  const router = useRouter();

  // Broker configuration
  const [host, setHost] = useState("broker.hivemq.com");
  const [port, setPort] = useState("8884");
  const [path, setPath] = useState("/mqtt");
  const [secure, setSecure] = useState(true);

  // Optional authentication
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Connection status
  const [status, setStatus] = useState("Disconnected");
  const [connecting, setConnecting] = useState(false);

  function connect() {
    const cleanHost = host.trim();
    const cleanPath = path.trim();
    const portNumber = Number(port);

    if (!cleanHost || !port || !cleanPath) {
      Alert.alert(
        "Missing information",
        "Fill in the broker address, port and path.",
      );
      return;
    }

    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      Alert.alert("Invalid port", "Enter a valid port between 1 and 65535.");
      return;
    }

    if (!cleanPath.startsWith("/")) {
      Alert.alert("Invalid path", "The WebSocket path must start with /.");
      return;
    }

    setStatus("Connecting...");
    setConnecting(true);

    connectToBroker(
      {
        host: cleanHost,
        port: portNumber,
        path: cleanPath,
        secure,
        username: username || undefined,
        password: password || undefined,
      },
      () => {
        setStatus("Connected!");
        setConnecting(false);
      },
      (error) => {
        console.log("MQTT Error:", error.message);
        setStatus("Connection error");
        setConnecting(false);
      },
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>My MQTT App</Text>

      <Text style={styles.subtitle}>Broker Configuration</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Broker Address</Text>

        <TextInput
          style={styles.input}
          placeholder="broker.example.com"
          value={host}
          onChangeText={setHost}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Port</Text>

        <TextInput
          style={styles.input}
          placeholder="8884"
          value={port}
          onChangeText={setPort}
          keyboardType="numeric"
        />

        <Text style={styles.label}>WebSocket Path</Text>

        <TextInput
          style={styles.input}
          placeholder="/mqtt"
          value={path}
          onChangeText={setPath}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label}>Secure WebSocket</Text>
            <Text style={styles.description}>
              {secure ? "WSS (encrypted)" : "WS (not encrypted)"}
            </Text>
          </View>

          <Switch
            value={secure}
            onValueChange={(value) => {
              setSecure(value);
              setPort(value ? "8884" : "8000");
            }}
          />
        </View>
      </View>

      <Text style={styles.subtitle}>Authentication (Optional)</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Username</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <Text style={styles.status}>Status: {status}</Text>

      <Button
        title={connecting ? "Connecting..." : "Connect"}
        onPress={connect}
        disabled={connecting}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 60,
    gap: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  section: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 10,
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  description: {
    color: "#777777",
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: "#aaaaaa",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: "600",
  },
});
