import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, User, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Character {
  title: string;
  snippet: string;
  pageid?: number;
}

interface CharacterSelectorProps {
  selectedCharacter: Character | null;
  onCharacterSelect: (character: Character) => void;
  searchFunction: (query: string) => Promise<Character[]>;
  title?: string;
  description?: string;
  placeholder?: string;
  className?: string;
}

const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  selectedCharacter,
  onCharacterSelect,
  searchFunction,
  title = "Seleziona un Personaggio",
  description = "Cerca e seleziona un personaggio per iniziare l'attività.",
  placeholder = "Cerca un personaggio storico...",
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Character[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.warning('Inserisci un termine di ricerca');
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchFunction(searchQuery.trim());
      setSearchResults(results);
      
      if (results.length === 0) {
        toast.info('Nessun personaggio trovato. Prova con un altro termine.');
      }
    } catch (error) {
      console.error('Errore durante la ricerca:', error);
      toast.error('Errore durante la ricerca. Riprova più tardi.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  return (
    <Card className={`p-6 bg-white/90 backdrop-blur-sm border-education/20 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-education/10 rounded-full mb-4">
            <User className="h-8 w-8 text-education" />
          </div>
          <h2 className="text-xl font-heading font-bold text-education-dark mb-2">
            {title}
          </h2>
          <p className="text-education-muted text-sm">
            {description}
          </p>
        </div>

        {/* Search Section */}
        <div className="space-y-4">
          <Label htmlFor="character-search" className="text-base font-medium text-education-dark">
            Cerca Personaggio
          </Label>
          
          <div className="flex gap-2">
            <Input
              id="character-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={isSearching}
              className="flex-1 border-education/30 focus:border-education focus:ring-education/20"
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="bg-education hover:bg-education-dark text-white"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Selected Character */}
        {selectedCharacter && (
          <Card className="p-4 bg-education/5 border-education/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-education/20 rounded-full flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-education" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-education-dark truncate">
                    {selectedCharacter.title}
                  </h3>
                  <Badge variant="secondary" className="bg-education/20 text-education">
                    Selezionato
                  </Badge>
                </div>
                <p className="text-sm text-education-muted line-clamp-3">
                  {selectedCharacter.snippet}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-medium text-education-dark">
              Risultati della Ricerca
            </Label>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {searchResults.map((character, index) => (
                <Card
                  key={character.pageid || index}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md border ${
                    selectedCharacter?.title === character.title
                      ? 'border-education bg-education/5'
                      : 'border-gray-200 hover:border-education/50'
                  }`}
                  onClick={() => onCharacterSelect(character)}
                >
                  <div className="space-y-2">
                    <h4 className="font-semibold text-education-dark">
                      {character.title}
                    </h4>
                    <p className="text-sm text-education-muted line-clamp-2">
                      {character.snippet}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {searchQuery && searchResults.length === 0 && !isSearching && (
          <div className="text-center py-8 text-education-muted">
            <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nessun risultato trovato per "{searchQuery}"</p>
            <p className="text-sm">Prova con un termine diverso</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default CharacterSelector;
