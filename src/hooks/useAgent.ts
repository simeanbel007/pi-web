import { useEffect, useRef } from "react";
import { AgentClient } from "@/lib/agent-client";
import { useAgentStore, applyEvent } from "@/store/agent-store";
import type { UserMessage } from "@earendil-works/pi-ai";

const client = new AgentClient();

/**
 * Core hook that manages the WebSocket connection to the pi agent process
 * and subscribes to agent events.
 */
export function useAgent(options: { cwd?: string; autoConnect?: boolean } = {}) {
  const store = useAgentStore();
  const connectingRef = useRef(false);

  useEffect(() => {
    if (!options.autoConnect) return;

    if (!connectingRef.current) {
      connectingRef.current = true;
      const connect = async () => {
        try {
          await client.connect(options.cwd);
          store.setConnected(true);

          try {
            const state = (await client.getState()) as {
              model?: { provider: string; id: string; name?: string };
              thinkingLevel?: string;
              sessionId?: string;
            };
            if (state.model) {
              store.setModel({
                provider: state.model.provider,
                id: state.model.id,
                name: state.model.name ?? state.model.id,
              });
            }
            if (state.thinkingLevel) store.setThinkingLevel(state.thinkingLevel);
            if (state.sessionId) store.setSessionId(state.sessionId);
          } catch {
            // getState may fail if agent isn't fully initialized yet
          }
        } catch (err) {
          console.error("Failed to connect to agent:", err);
          store.setConnected(false);
          connectingRef.current = false;
        }
      };
      connect();
    }

    const unsubEvent = client.onEvent((event) => {
      applyEvent(event, useAgentStore.getState());
    });

    const unsubState = client.onStateChange((connected) => {
      store.setConnected(connected);
    });

    return () => {
      unsubEvent();
      unsubState();
    };
  }, [options.autoConnect, options.cwd]);

  const switchToWorkspace = async (path: string) => {
    try {
      await client.switchWorkspace(path);
    } catch (err) {
      console.error("Failed to switch workspace:", err);
      throw err;
    }
  };

  return {
    client,
    connected: store.connected,
    messages: store.messages,
    streamingMessage: store.streamingMessage,
    isStreaming: store.isStreaming,
    cwd: client.cwd,
    switchToWorkspace,
    sendMessage: (text: string) => {
      const userMessage: UserMessage = {
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      };
      store.addMessage(userMessage);
      client.prompt(text);
    },
    steer: (text: string) => client.steer(text),
    abort: () => client.abort(),
  };
}
