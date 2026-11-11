import mqtt from 'mqtt';

export interface BrokerConfig {
  host: string;
  port: number;
  path: string;
  secure: boolean;
  username?: string;
  password?: string;
}

type MessageListener = (topic: string, message: string) => void;

let mqttClient: ReturnType<typeof mqtt.connect> | null = null;

const connectionListeners = new Set<(connected: boolean) => void>();
const messageListeners = new Set<MessageListener>();

function notifyConnectionStatus(connected: boolean) {
  connectionListeners.forEach((listener) => listener(connected));
}

function notifyMessage(topic: string, message: string) {
  messageListeners.forEach((listener) => listener(topic, message));
}

export function subscribeToConnectionStatus(
  listener: (connected: boolean) => void,
) {
  connectionListeners.add(listener);
  listener(mqttClient?.connected ?? false);

  return () => {
    connectionListeners.delete(listener);
  };
}

export function subscribeToMqttMessages(listener: MessageListener) {
  messageListeners.add(listener);

  return () => {
    messageListeners.delete(listener);
  };
}

export function connectToBroker(
  config: BrokerConfig,
  onConnected: () => void,
  onError: (error: Error) => void,
) {
  if (mqttClient) {
    const oldClient = mqttClient;
    mqttClient = null;
    oldClient.end(true);
  }

  notifyConnectionStatus(false);

  const protocol = config.secure ? 'wss' : 'ws';
  const url = `${protocol}://${config.host}:${config.port}${config.path}`;

  console.log('Connecting to:', url);

  const client = mqtt.connect(url, {
    clientId: `expo_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,

    ...(config.username ? { username: config.username } : {}),
    ...(config.password ? { password: config.password } : {}),
  });

  mqttClient = client;

  client.on('connect', () => {
    if (mqttClient !== client) return;

    notifyConnectionStatus(true);
    onConnected();
  });

  client.on('close', () => {
    if (mqttClient !== client) return;
    notifyConnectionStatus(false);
  });

  client.on('offline', () => {
    if (mqttClient !== client) return;
    notifyConnectionStatus(false);
  });

  client.on('message', (topic, payload) => {
    if (mqttClient !== client) return;
    notifyMessage(topic, payload.toString());
  });

  client.on('error', (error) => {
    if (mqttClient !== client) return;
    onError(error);
  });

  return client;
}

export function getMqttClient() {
  return mqttClient;
}

export function disconnectFromBroker() {
  const client = mqttClient;
  mqttClient = null;

  client?.end(true);

  notifyConnectionStatus(false);
}