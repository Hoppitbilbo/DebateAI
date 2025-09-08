/**
 * @file A demonstration component for a basic chat interface with the Vertex AI service.
 * @remarks This component initializes a chat session, displays a hardcoded initial history,
 * and allows the user to send messages and receive responses from the AI. It serves as a
 * basic example of using the `aiService`.
 */

import React, { useState, useEffect } from 'react';
import { startChat, sendMessage } from '@/services/aiService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { ChatSession } from '@google/generative-ai';

/**
 * @function VertexAIChat
 * @description A simple chat component to demonstrate the core functionality of the AI service.
 * @returns {JSX.Element} The rendered chat component.
 */
const VertexAIChat: React.FC = () => {
  const [chat, setChat] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const newChat = startChat();
    setChat(newChat);
    setChatHistory([
      { role: 'user', text: 'Hello, I have 2 dogs in my house.' },
      { role: 'model', text: 'Great to meet you. What would you like to know?' },
    ]);
  }, []);

  /**
   * @function handleSendMessage
   * @description Sends the user's message to the AI service and updates the chat history
   * with both the user's message and the AI's response.
   */
  const handleSendMessage = async () => {
    if (chat && message.trim() !== '') {
      setIsLoading(true);
      setChatHistory(prev => [...prev, { role: 'user', text: message }]);
      try {
        const responseText = await sendMessage(chat, message);
        setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
      } catch (error) {
        console.error('Error sending message:', error);
        setChatHistory(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error.' }]);
      }
      setMessage('');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Vertex AI Chat</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {chatHistory.map((entry, index) => (
            <div key={index} className={`p-2 rounded-lg ${
              entry.role === 'user' ? 'bg-blue-100 text-blue-800 self-end text-right' : 'bg-gray-100 text-gray-800 self-start text-left'
            }`}>
              <p><strong>{entry.role === 'user' ? 'You' : 'AI'}:</strong> {entry.text}</p>
            </div>
          ))}
        </div>
        <div className="flex space-x-2">
          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !message.trim()}>
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default VertexAIChat;
