import React, { useState, useEffect } from 'react';
import { startChat, sendMessage } from '@/services/aiService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { ChatSession } from '@google/generative-ai'; // Import ChatSession type

const VertexAIChat: React.FC = () => {
  const [chat, setChat] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize chat when component mounts
    const newChat = startChat();
    setChat(newChat);
    // Set initial history based on the example provided for the chat service
    setChatHistory([
      { role: 'user', text: 'Hello, I have 2 dogs in my house.' },
      { role: 'model', text: 'Great to meet you. What would you like to know?' },
    ]);
  }, []);

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
