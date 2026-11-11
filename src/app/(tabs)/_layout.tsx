import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4DA3FF",
        tabBarInactiveTintColor: "#888888",
        tabBarStyle: {
          backgroundColor: "#17191F",
          borderTopColor: "#292D37",
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Connection",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "wifi" : "wifi-outline"}
              size={size}
              color={
                typeof color === "number" ? "#888888" : (color ?? "#888888")
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="pubsub"
        options={{
          title: "Pub/Sub",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "swap-horizontal" : "swap-horizontal-outline"}
              size={size}
              color={
                typeof color === "number" ? "#888888" : (color ?? "#888888")
              }
            />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "chatbubble" : "chatbubbles-outline"}
              size={size}
              color={
                typeof color === "number" ? "#888888" : (color ?? "#888888")
              }
            />
          ),
        }}
      />
    </Tabs>
  );
}
