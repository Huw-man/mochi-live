'use client';

import { useConversation } from '@elevenlabs/react';
import { useCallback, useState } from 'react';
import { VRMScene } from './vrm-scene';

export function AvatarConversation() {
  const [animationTrigger, setAnimationTrigger] = useState<{
    animation: string;
    timestamp: number;
  } | null>(null);

  const conversation = useConversation({
    onConnect: () => console.log('✅ ElevenLabs Connected'),
    onDisconnect: () => console.log('❌ ElevenLabs Disconnected'),
    onMessage: (message) => {
      console.log('💬 Message:', message);
    },
    onError: (error) => console.error('🚨 Error:', error),
    clientTools: {
      playAnimation: (parameters: { animation: string }) => {
        console.log('🎭 Client tool called: playAnimation', parameters);

        // Trigger animation by updating state
        setAnimationTrigger({
          animation: parameters.animation,
          timestamp: Date.now(),
        });

        return `Animation "${parameters.animation}" triggered successfully`;
      },
    },
  });

  // Debug: Log conversation state changes
  console.log('🔄 Conversation State:', {
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
  });

  const startConversation = useCallback(async () => {
    console.log('🎤 Starting conversation...');
    try {
      // Request microphone permission
      console.log('🎤 Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone permission granted');

      // Start the conversation with your agent
      console.log('🚀 Starting ElevenLabs session...');
      await conversation.startSession({
        agentId: 'agent_6301k6445fe3fb4b6t524awm29j6',
        connectionType: 'websocket',
        userId: 'YOUR_CUSTOMER_USER_ID' // Optional field for tracking your end user IDs
      });
      console.log('✅ Session started successfully');

    } catch (error) {
      console.error('❌ Failed to start conversation:', error);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    console.log('🛑 Stopping conversation...');
    await conversation.endSession();
    console.log('✅ Conversation stopped');
  }, [conversation]);

  return (
    <>
      {/* VRM Avatar Scene */}
      <VRMScene conversation={conversation} animationTrigger={animationTrigger} />

      {/* Conversation Controls */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
        <div className="flex flex-col items-center gap-4 bg-black/50 p-6 rounded-lg backdrop-blur-sm">
          <div className="flex gap-2">
            <button
              onClick={startConversation}
              disabled={conversation.status === 'connected'}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              Start Conversation
            </button>
            <button
              onClick={stopConversation}
              disabled={conversation.status !== 'connected'}
              className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
            >
              Stop Conversation
            </button>
          </div>

          <div className="flex flex-col items-center text-white">
            <p className="text-sm text-gray-300">
              Status: <span className="font-medium">{conversation.status}</span>
            </p>
            <p className="text-sm text-gray-300">
              Agent: <span className="font-medium">{conversation.isSpeaking ? 'Speaking' : 'Listening'}</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}