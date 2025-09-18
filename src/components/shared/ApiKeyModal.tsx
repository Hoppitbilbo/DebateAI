import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Key, Eye, EyeOff } from 'lucide-react';
import { useApiKey } from '@/context/ApiKeyContext';
import { reinitializeAiService } from '@/services/aiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const { setApiKey, apiKey, clearApiKey } = useApiKey();
  const [inputValue, setInputValue] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (inputValue.trim()) {
      setApiKey(inputValue.trim());
      // Reinitialize AI service with new key
      reinitializeAiService();
      onClose();
    }
  };

  const handleClear = () => {
    clearApiKey();
    setInputValue('');
    // Reinitialize AI service (will disable it since no key)
    reinitializeAiService();
  };

  const handleClose = () => {
    setInputValue(apiKey || '');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Insert Your API Key
          </DialogTitle>
          <DialogDescription>
            Enter your Google AI Studio API key to enable AI features. Your key will be stored securely in your browser session.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                placeholder="Enter your Gemini API key..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 mb-2">
              <strong>How to get your API key:</strong>
            </p>
            <ol className="text-sm text-blue-700 space-y-1 ml-4 list-decimal">
              <li>Visit Google AI Studio</li>
              <li>Sign in with your Google account</li>
              <li>Create a new API key</li>
              <li>Copy and paste it here</li>
            </ol>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
            >
              Open Google AI Studio
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex justify-between gap-2">
            <div className="flex gap-2">
              {apiKey && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Clear Key
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!inputValue.trim()}
                className="bg-education hover:bg-education-light text-education-dark"
              >
                Save API Key
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyModal;