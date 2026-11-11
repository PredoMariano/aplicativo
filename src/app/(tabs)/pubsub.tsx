
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  disconnectFromBroker,
  getMqttClient,
  subscribeToConnectionStatus,
} from '../../services/mqtt';

type ReceivedMessage = {
  topic: string;
  message: string;
  time: string;
};

export default function PubSubScreen() {
  // Connection status
  const [connected, setConnected] = useState(false);

  // Publishing inputs
  const [publishTopic, setPublishTopic] = useState('');
  const [publishMessage, setPublishMessage] = useState('');

  // Subscription input
  const [subscribeTopic, setSubscribeTopic] = useState('');

  // Active subscriptions
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  // Incoming messages
  const [messages, setMessages] = useState<ReceivedMessage[]>([]);

  // Monitor connection status and incoming messages
  useEffect(() => {
    const unsubscribeStatus = subscribeToConnectionStatus(setConnected);

    const client = getMqttClient();

    if (!client) {
      return unsubscribeStatus;
    }

    function handleMessage(topic: string, payload: Buffer) {
      const message = payload.toString();

      setMessages((previous) => [
        {
          topic,
          message,
          time: new Date().toLocaleTimeString(),
        },
        ...previous,
      ]);
    }

    client.on('message', handleMessage);

    return () => {
      client.removeListener('message', handleMessage);
      unsubscribeStatus();
    };
  }, []);

  // Publish a message
  function publishMessageToBroker() {
    const client = getMqttClient();

    if (!client?.connected) {
      Alert.alert('Not connected', 'Connect to the MQTT broker first.');
      return;
    }

    const topic = publishTopic.trim();
    const message = publishMessage.trim();

    if (!topic || !message) {
      Alert.alert('Missing information', 'Enter both a topic and a message.');
      return;
    }

    client.publish(topic, message, { qos: 0 }, (error) => {
      if (error) {
        Alert.alert('Publish failed', error.message);
      } else {
        Alert.alert('Published', 'Message sent successfully.');
        setPublishMessage('');
      }
    });
  }

  // Subscribe to a topic
  function subscribeToTopic() {
    const client = getMqttClient();

    if (!client?.connected) {
      Alert.alert('Not connected', 'Connect to the MQTT broker first.');
      return;
    }

    const topic = subscribeTopic.trim();

    if (!topic) {
      Alert.alert('Missing topic', 'Enter a topic to subscribe to.');
      return;
    }

    if (subscriptions.includes(topic)) {
      Alert.alert(
        'Already subscribed',
        'You are already listening to this topic.',
      );
      return;
    }

    client.subscribe(topic, { qos: 0 }, (error) => {
      if (error) {
        Alert.alert('Subscription failed', error.message);
      } else {
        setSubscriptions((previous) => [...previous, topic]);
        setSubscribeTopic('');
      }
    });
  }

  // Unsubscribe from a topic
  function unsubscribeFromTopic(topic: string) {
    const client = getMqttClient();

    if (!client?.connected) {
      Alert.alert('Not connected', 'Connect to the MQTT broker first.');
      return;
    }

    client.unsubscribe(topic, (error) => {
      if (error) {
        Alert.alert('Unsubscribe failed', error.message);
      } else {
        setSubscriptions((previous) =>
          previous.filter((item) => item !== topic),
        );
      }
    });
  }

  // Disconnect from the broker
  function disconnect() {
    disconnectFromBroker();
    setSubscriptions([]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>MQTT PubSub</Text>

        <View style={styles.connectionRow}>
          <Text
            style={[
              styles.status,
              { color: connected ? '#16803c' : '#d14343' },
            ]}
          >
            Status: {connected ? 'Connected' : 'Disconnected'}
          </Text>

          <Button
            title="Disconnect"
            color="red"
            onPress={disconnect}
            disabled={!connected}
          />
        </View>

        {/* PUBLISH SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Publish</Text>

          <TextInput
            style={styles.input}
            placeholder="Topic"
            value={publishTopic}
            onChangeText={setPublishTopic}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Message / Payload"
            value={publishMessage}
            onChangeText={setPublishMessage}
          />

          <Button
            title="Publish Message"
            onPress={publishMessageToBroker}
          />
        </View>

        {/* SUBSCRIBE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscribe</Text>

          <TextInput
            style={styles.input}
            placeholder="Topic to subscribe to"
            value={subscribeTopic}
            onChangeText={setSubscribeTopic}
            autoCapitalize="none"
          />

          <Button title="Subscribe" onPress={subscribeToTopic} />

          <Text style={styles.subheading}>Active subscriptions</Text>

          {subscriptions.length === 0 ? (
            <Text style={styles.empty}>No subscriptions yet.</Text>
          ) : (
            subscriptions.map((topic) => (
              <View key={topic} style={styles.topicRow}>
                <Text style={styles.topicText}>{topic}</Text>

                <Button
                  title="Unsubscribe"
                  onPress={() => unsubscribeFromTopic(topic)}
                />
              </View>
            ))
          )}
        </View>

        {/* INCOMING MESSAGES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incoming Messages</Text>

          {messages.length === 0 ? (
            <Text style={styles.empty}>Waiting for messages...</Text>
          ) : (
            messages.map((item, index) => (
              <View
                key={`${item.time}-${index}`}
                style={styles.messageCard}
              >
                <Text style={styles.messageTopic}>{item.topic}</Text>
                <Text style={styles.messagePayload}>{item.message}</Text>
                <Text style={styles.timestamp}>{item.time}</Text>
              </View>
            ))
          )}

          <Button
            title="Clear Messages"
            onPress={() => setMessages([])}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 60,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    gap: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaaaaa',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  empty: {
    color: '#888888',
  },
  topicRow: {
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#dddddd',
  },
  topicText: {
    fontSize: 14,
  },
  messageCard: {
    padding: 12,
    backgroundColor: '#eeeeee',
    borderRadius: 8,
    gap: 5,
  },
  messageTopic: {
    fontSize: 12,
    color: '#555555',
  },
  messagePayload: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 11,
    color: '#777777',
  },
});
