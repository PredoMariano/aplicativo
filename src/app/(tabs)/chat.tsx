import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    getMqttClient,
    subscribeToConnectionStatus,
    subscribeToMqttMessages,
} from "../../services/mqtt";

type TopicType = "pub" | "sub" | "both";

type Topic = {
  id: string;
  name: string;
  path: string;
  type: TopicType;
};

type ChatMessage = {
  id: string;
  topic: string;
  message: string;
  direction: "sent" | "received";
  time: string;
};

const PREFIX = "iotclass/esp32_7f3a";

const INITIAL_TOPICS: Topic[] = [
  {
    id: "1",
    name: "Text",
    path: `${PREFIX}/text`,
    type: "both",
  },
  {
    id: "2",
    name: "Command",
    path: `${PREFIX}/command`,
    type: "pub",
  },
  {
    id: "3",
    name: "Temperature",
    path: `${PREFIX}/temperature`,
    type: "sub",
  },
  {
    id: "4",
    name: "Status",
    path: `${PREFIX}/status`,
    type: "sub",
  },
];

export default function ChatScreen() {
  const [connected, setConnected] = useState(false);

  const [topics, setTopics] = useState<Topic[]>(INITIAL_TOPICS);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const [selectedPubTopic, setSelectedPubTopic] = useState(`${PREFIX}/text`);

  const [selectedSubTopic, setSelectedSubTopic] = useState("");
  const [showAllMessages, setShowAllMessages] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);

  const [topicNameInput, setTopicNameInput] = useState("");
  const [topicPathInput, setTopicPathInput] = useState("");
  const [topicTypeInput, setTopicTypeInput] = useState<TopicType>("both");

  const pubTopics = useMemo(
    () =>
      topics.filter((topic) => topic.type === "pub" || topic.type === "both"),
    [topics],
  );

  const subTopics = useMemo(
    () =>
      topics.filter((topic) => topic.type === "sub" || topic.type === "both"),
    [topics],
  );

  // Only controls which messages are visible in the interface.
  const visibleMessages = useMemo(() => {
    if (showAllMessages) {
      return messages;
    }

    return messages.filter((message) => message.topic === selectedSubTopic);
  }, [messages, showAllMessages, selectedSubTopic]);

  // Listen for connection changes.
  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus((status) => {
      setConnected(status);
    });

    return unsubscribe;
  }, []);

  // Listen for incoming MQTT messages.
  useEffect(() => {
    const unsubscribe = subscribeToMqttMessages((topic, message) => {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random()}`,
          topic,
          message,
          direction: "received",
          time: new Date().toLocaleTimeString(),
        },
      ]);
    });

    return unsubscribe;
  }, []);

  // Subscribe to every topic configured as SUB or BOTH.
  // The selected SUB topic is only a visual filter.
  useEffect(() => {
    if (!connected) return;

    const client = getMqttClient();

    if (!client || !client.connected) return;

    const paths = subTopics.map((topic) => topic.path);

    paths.forEach((path) => {
      client.subscribe(path, (error) => {
        if (error) {
          console.log("Subscribe error:", path, error);
        } else {
          console.log("Subscribed to:", path);
        }
      });
    });

    return () => {
      paths.forEach((path) => {
        client.unsubscribe(path);
      });
    };
  }, [connected, subTopics]);

  function sendMessage() {
    const text = messageInput.trim();

    if (!text) return;

    if (!connected) {
      Alert.alert("Not connected", "Connect to the MQTT broker first.");
      return;
    }

    const client = getMqttClient();

    if (!client || !client.connected) {
      Alert.alert("Connection error", "The MQTT client is not connected.");
      return;
    }

    client.publish(selectedPubTopic, text, { qos: 0 }, (error) => {
      if (error) {
        Alert.alert("Publish error", error.message);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random()}`,
          topic: selectedPubTopic,
          message: text,
          direction: "sent",
          time: new Date().toLocaleTimeString(),
        },
      ]);

      setMessageInput("");
    });
  }

  function openNewTopicModal() {
    setEditingTopicId(null);
    setTopicNameInput("");
    setTopicPathInput(`${PREFIX}/`);
    setTopicTypeInput("both");
    setModalVisible(true);
  }

  function openEditTopicModal(topic: Topic) {
    setEditingTopicId(topic.id);
    setTopicNameInput(topic.name);
    setTopicPathInput(topic.path);
    setTopicTypeInput(topic.type);
    setModalVisible(true);
  }

  function saveTopic() {
    const name = topicNameInput.trim();
    const path = topicPathInput.trim();

    if (!name || !path) {
      Alert.alert("Missing information", "Enter a name and a topic path.");
      return;
    }

    if (path.includes(" ")) {
      Alert.alert("Invalid topic", "Topic paths cannot contain spaces.");
      return;
    }

    if (editingTopicId) {
      setTopics((current) =>
        current.map((topic) =>
          topic.id === editingTopicId
            ? { ...topic, name, path, type: topicTypeInput }
            : topic,
        ),
      );

      if (
        selectedPubTopic ===
        topics.find((topic) => topic.id === editingTopicId)?.path
      ) {
        setSelectedPubTopic(path);
      }
    } else {
      const newTopic: Topic = {
        id: `${Date.now()}`,
        name,
        path,
        type: topicTypeInput,
      };

      setTopics((current) => [...current, newTopic]);

      if (
        (topicTypeInput === "pub" || topicTypeInput === "both") &&
        !selectedPubTopic
      ) {
        setSelectedPubTopic(path);
      }
    }

    setModalVisible(false);
  }

  function deleteTopic(topic: Topic) {
    Alert.alert("Delete topic", `Do you want to delete "${topic.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setTopics((current) =>
            current.filter((item) => item.id !== topic.id),
          );

          if (selectedPubTopic === topic.path) {
            const replacement = pubTopics.find((item) => item.id !== topic.id);

            setSelectedPubTopic(replacement?.path ?? "");
          }

          if (selectedSubTopic === topic.path) {
            setSelectedSubTopic("");
            setShowAllMessages(true);
          }
        },
      },
    ]);
  }

  function selectSubTopic(path: string) {
    setSelectedSubTopic(path);
    setShowAllMessages(false);
  }

  function renderTopicButton(
    topic: Topic,
    selected: boolean,
    onPress: () => void,
  ) {
    return (
      <TouchableOpacity
        key={topic.id}
        style={[styles.topicChip, selected && styles.topicChipSelected]}
        onPress={onPress}
      >
        <Text
          style={[
            styles.topicChipText,
            selected && styles.topicChipTextSelected,
          ]}
        >
          {topic.name}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 85 : 0}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>MQTT Chat</Text>
          <Text style={styles.subtitle}>Publish & Subscribe</Text>
        </View>

        <View style={styles.connectionContainer}>
          <View
            style={[
              styles.connectionDot,
              connected ? styles.connectedDot : styles.disconnectedDot,
            ]}
          />
          <Text style={styles.connectionText}>
            {connected ? "Connected" : "Disconnected"}
          </Text>
        </View>
      </View>

      {/* PUB TOPICS */}
      <View style={styles.topicSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PUB</Text>
          <Text style={styles.sectionDescription}>Send messages</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicList}
        >
          {pubTopics.map((topic) =>
            renderTopicButton(topic, selectedPubTopic === topic.path, () =>
              setSelectedPubTopic(topic.path),
            ),
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={openNewTopicModal}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.selectedTopic} numberOfLines={1}>
          {selectedPubTopic || "No PUB topic selected"}
        </Text>
      </View>

      {/* SUB TOPICS */}
      <View style={styles.topicSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SUB</Text>
          <Text style={styles.sectionDescription}>
            Filter received messages
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicList}
        >
          <TouchableOpacity
            style={[
              styles.topicChip,
              showAllMessages && styles.topicChipSelected,
            ]}
            onPress={() => {
              setShowAllMessages(true);
              setSelectedSubTopic("");
            }}
          >
            <Text
              style={[
                styles.topicChipText,
                showAllMessages && styles.topicChipTextSelected,
              ]}
            >
              All (#)
            </Text>
          </TouchableOpacity>

          {subTopics.map((topic) =>
            renderTopicButton(
              topic,
              !showAllMessages && selectedSubTopic === topic.path,
              () => selectSubTopic(topic.path),
            ),
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={openNewTopicModal}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.selectedTopic} numberOfLines={1}>
          {showAllMessages
            ? "Showing all topics"
            : selectedSubTopic || "Select a SUB topic"}
        </Text>
      </View>

      {/* MESSAGES */}
      <View style={styles.chatContainer}>
        <View style={styles.messagesHeader}>
          <Text style={styles.sectionTitle}>MESSAGES</Text>
          <Text style={styles.messageCount}>
            {visibleMessages.length} messages
          </Text>
        </View>

        <FlatList
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={34}
                color="#777777"
              />
              <Text style={styles.emptyText}>No messages to display</Text>
              <Text style={styles.emptyHint}>
                Choose another SUB filter or send a message.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const sent = item.direction === "sent";

            return (
              <View
                style={[
                  styles.messageRow,
                  sent ? styles.sentRow : styles.receivedRow,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    sent ? styles.sentBubble : styles.receivedBubble,
                  ]}
                >
                  <Text style={styles.messageTopic} numberOfLines={1}>
                    {item.topic}
                  </Text>

                  <Text style={styles.messageText}>{item.message}</Text>

                  <Text style={styles.messageTime}>
                    {sent ? "Sent" : "Received"} · {item.time}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* MESSAGE INPUT */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          value={messageInput}
          onChangeText={setMessageInput}
          placeholder="Type a message..."
          placeholderTextColor="#888888"
          multiline
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!connected || !messageInput.trim()) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!connected || !messageInput.trim() || !selectedPubTopic}
        >
          <Ionicons name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* TOPIC MANAGER MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTopicId ? "Edit topic" : "New topic"}
              </Text>

              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={25} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={topicNameInput}
              onChangeText={setTopicNameInput}
              placeholder="Example: Temperature"
              placeholderTextColor="#888888"
            />

            <Text style={styles.inputLabel}>Topic path</Text>
            <TextInput
              style={styles.modalInput}
              value={topicPathInput}
              onChangeText={setTopicPathInput}
              placeholder="iotclass/example/temperature"
              placeholderTextColor="#888888"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Type</Text>

            <View style={styles.typeSelector}>
              {(
                [
                  ["pub", "PUB"],
                  ["sub", "SUB"],
                  ["both", "BOTH"],
                ] as [TopicType, string][]
              ).map(([type, label]) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    topicTypeInput === type && styles.typeButtonSelected,
                  ]}
                  onPress={() => setTopicTypeInput(type)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      topicTypeInput === type && styles.typeButtonTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={saveTopic}>
              <Text style={styles.saveButtonText}>Save topic</Text>
            </TouchableOpacity>

            {editingTopicId && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  const topic = topics.find(
                    (item) => item.id === editingTopicId,
                  );

                  if (topic) {
                    setModalVisible(false);
                    deleteTopic(topic);
                  }
                }}
              >
                <Text style={styles.deleteButtonText}>Delete topic</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* TOPIC MANAGEMENT ACCESS */}
      <TouchableOpacity
        style={styles.manageButton}
        onPress={() => {
          Alert.alert("Manage topics", "Choose an action", [
            { text: "Add topic", onPress: openNewTopicModal },
            {
              text: "Edit existing topic",
              onPress: () => {
                if (topics.length === 0) return;

                Alert.alert("Select a topic", undefined, [
                  ...topics.map((topic) => ({
                    text: topic.name,
                    onPress: () => openEditTopicModal(topic),
                  })),
                  { text: "Cancel", style: "cancel" as const },
                ]);
              },
            },
            { text: "Cancel", style: "cancel" },
          ]);
        }}
      >
        <Ionicons name="settings-outline" size={16} color="#AAAAAA" />
        <Text style={styles.manageButtonText}>Manage topics</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111111",
    paddingTop: Platform.OS === "android" ? 45 : 55,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#888888",
    fontSize: 12,
    marginTop: 3,
  },
  connectionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedDot: {
    backgroundColor: "#35C979",
  },
  disconnectedDot: {
    backgroundColor: "#E05252",
  },
  connectionText: {
    color: "#AAAAAA",
    fontSize: 11,
  },
  topicSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#292929",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 9,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionDescription: {
    color: "#777777",
    fontSize: 11,
  },
  topicList: {
    alignItems: "center",
    gap: 7,
  },
  topicChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#383838",
  },
  topicChipSelected: {
    backgroundColor: "#E8E8E8",
    borderColor: "#E8E8E8",
  },
  topicChipText: {
    color: "#BBBBBB",
    fontSize: 12,
    fontWeight: "600",
  },
  topicChipTextSelected: {
    color: "#111111",
  },
  addButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: "#343434",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTopic: {
    color: "#777777",
    fontSize: 10,
    marginTop: 8,
  },
  chatContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#292929",
  },
  messagesHeader: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  messageCount: {
    color: "#777777",
    fontSize: 11,
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexGrow: 1,
  },
  messageRow: {
    width: "100%",
    marginBottom: 9,
    flexDirection: "row",
  },
  sentRow: {
    justifyContent: "flex-end",
  },
  receivedRow: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
  },
  sentBubble: {
    backgroundColor: "#343E55",
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: "#292929",
    borderBottomLeftRadius: 4,
  },
  messageTopic: {
    color: "#A9B9DC",
    fontSize: 10,
    marginBottom: 5,
  },
  messageText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  messageTime: {
    color: "#999999",
    fontSize: 9,
    marginTop: 7,
    textAlign: "right",
  },
  emptyContainer: {
    flex: 1,
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    color: "#BBBBBB",
    fontSize: 13,
  },
  emptyHint: {
    color: "#777777",
    fontSize: 11,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#292929",
    gap: 9,
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: "#242424",
    borderRadius: 13,
    color: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#4267B2",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 9,
  },
  manageButtonText: {
    color: "#AAAAAA",
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1D1D1D",
    borderRadius: 18,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
  },
  inputLabel: {
    color: "#BBBBBB",
    fontSize: 12,
    marginBottom: 7,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 13,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 8,
    marginTop: 3,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
  },
  typeButtonSelected: {
    backgroundColor: "#E8E8E8",
  },
  typeButtonText: {
    color: "#BBBBBB",
    fontWeight: "700",
    fontSize: 12,
  },
  typeButtonTextSelected: {
    color: "#111111",
  },
  saveButton: {
    marginTop: 22,
    backgroundColor: "#4267B2",
    padding: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  deleteButton: {
    marginTop: 10,
    padding: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#E05252",
    fontWeight: "600",
  },
});
