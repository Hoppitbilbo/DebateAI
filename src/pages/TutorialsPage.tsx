import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Book, 
  Users, 
  Speech, 
  Search, 
  User, 
  MessageSquare, 
  Calendar,
  ExternalLink,
  BookOpen,
  Rocket,
  Lightbulb
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RedditButton from '@/components/shared/RedditButton';

const TutorialsPage = () => {
  const { t } = useTranslation();

  const tutorials = [
    {
      id: 'you-moderate',
      title: 'You Moderate',
      description: 'Conversa con personaggi AI basati su contenuti Wikipedia, trasformando argomenti educativi in conversazioni interattive.',
      icon: <Book className="h-8 w-8 text-white" />,
      appLink: '/apps/you-moderate',
      tutorialLink: '/apps/you-moderate/tutorial',
      available: true
    },
    {
      id: 'doppia-intervista',
      title: 'Doppia Intervista',
      description: 'Interagisci simultaneamente con due figure storiche in conversazioni parallele, creando un dialogo educativo unico.',
      icon: <Users className="h-8 w-8 text-white" />,
      appLink: '/apps/doppia-intervista',
      tutorialLink: '/apps/doppia-intervista/tutorial',
      available: true
    },
    {
      id: 'convinci-tu',
      title: 'Convinci Tu',
      description: 'Metti alla prova le tue capacità di persuasione cercando di convincere figure storiche delle tue idee.',
      icon: <Speech className="h-8 w-8 text-white" />,
      appLink: '/apps/convinci-tu',
      tutorialLink: '/apps/convinci-tu/tutorial',
      available: true
    },
    {
      id: 'personaggio-misterioso',
      title: 'Personaggio Misterioso',
      description: 'Sfida l\'AI facendo domande per indovinare la figura storica scelta. Hai un numero limitato di domande per scoprire l\'identità misteriosa!',
      icon: <Search className="h-8 w-8 text-white" />,
      appLink: '/apps/personaggio-misterioso',
      tutorialLink: '/apps/personaggio-misterioso/tutorial',
      available: true
    },
    {
      id: 'impersona-tu',
      title: 'Impersona Tu',
      description: 'Impersona figure storiche e rispondi alle domande come se fossi quel personaggio.',
      icon: <User className="h-8 w-8 text-white" />,
      appLink: '/apps/impersona-tu',
      tutorialLink: '/apps/impersona-tu/tutorial',
      available: true
    },
    {
      id: 'wiki-chatbot',
      title: 'WikiChat AI',
      description: 'Chatta con un\'intelligenza artificiale che rappresenta qualsiasi argomento di Wikipedia, perfetto per approfondimenti educativi interattivi.',
      icon: <MessageSquare className="h-8 w-8 text-white" />,
      appLink: '/apps/wiki-chatbot',
      tutorialLink: null,
      available: false
    }
  ];

  const comingSoon = [
    {
      id: 'prompt-engineer',
      title: 'Prompt Engineer per l\'Insegnamento',
      description: 'Aiuta insegnanti e studenti a creare prompt efficaci per l\'intelligenza artificiale nelle attività educative e di apprendimento.',
      icon: <Calendar className="h-8 w-8 text-white" />,
      appLink: '/apps/prompt-engineer'
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-education-light mb-4">
              📚 Tutorial delle Applicazioni
            </h1>
            <p className="text-xl text-gray-200 max-w-3xl mx-auto">
              Questa guida fornisce un accesso rapido a tutti i tutorial disponibili per le applicazioni educative di AI-Debate.Tech.
            </p>
          </div>

          {/* Available Tutorials */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <BookOpen className="mr-3" />
              Tutorial Disponibili
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tutorials.map((tutorial) => (
                <div key={tutorial.id} className="bg-card rounded-lg shadow-lg overflow-hidden border border-border">
                  <div className="bg-gradient-to-r from-education to-education-dark p-6">
                    <div className="flex items-center justify-between mb-4">
                      {tutorial.icon}
                      {tutorial.available && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          Disponibile
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{tutorial.title}</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-foreground mb-6">{tutorial.description}</p>
                    <div className="space-y-3">
                      <Link to={tutorial.appLink}>
                        <Button className="w-full bg-education hover:bg-education-dark text-white">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Apri Applicazione
                        </Button>
                      </Link>
                      {tutorial.tutorialLink ? (
                        <Link to={tutorial.tutorialLink}>
                          <Button variant="outline" className="w-full border-education text-education hover:bg-education hover:text-white">
                            <Book className="w-4 h-4 mr-2" />
                            Visualizza Tutorial
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" disabled className="w-full">
                          <Book className="w-4 h-4 mr-2" />
                          Tutorial in arrivo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Coming Soon */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <Rocket className="mr-3" />
              Applicazioni in Sviluppo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {comingSoon.map((app) => (
                <div key={app.id} className="bg-card rounded-lg shadow-lg overflow-hidden border border-border opacity-75">
                  <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-6">
                    <div className="flex items-center justify-between mb-4">
                      {app.icon}
                      <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                        In arrivo
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{app.title}</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-foreground mb-6">{app.description}</p>
                    <Button disabled className="w-full">
                      <Calendar className="w-4 h-4 mr-2" />
                      Prossimamente
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Additional Resources */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <BookOpen className="mr-3" />
              Risorse Aggiuntive
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="text-xl font-bold text-education-light mb-4">Guida per Insegnanti</h3>
                <p className="text-foreground mb-6">
                  Una guida completa su come utilizzare le nostre applicazioni per creare esperienze di apprendimento innovative e coinvolgenti.
                </p>
                <Link to="/teacher-guide">
                  <Button className="bg-education hover:bg-education-dark text-white">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Visualizza Guida
                  </Button>
                </Link>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="text-xl font-bold text-education-light mb-4">Tutte le Applicazioni</h3>
                <p className="text-foreground mb-6">
                  Visualizza tutte le applicazioni disponibili in un'unica pagina per una panoramica completa.
                </p>
                <Link to="/apps">
                  <Button className="bg-education hover:bg-education-dark text-white">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Esplora Applicazioni
                  </Button>
                </Link>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="text-xl font-bold text-education-light mb-4">Community Reddit</h3>
                <p className="text-foreground mb-6">
                  Unisciti alla nostra community su Reddit per condividere esperienze, idee e sperimentazioni didattiche con altri educatori.
                </p>
                <RedditButton variant="default" className="w-full" />
              </div>
            </div>
          </section>

          {/* How to Start */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <Rocket className="mr-3" />
              Come Iniziare
            </h2>
            <div className="bg-card rounded-lg shadow-lg p-8 border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">1</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">Scegli un'applicazione</h3>
                  <p className="text-sm text-foreground">Dalla lista sopra</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">2</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">Leggi il tutorial</h3>
                  <p className="text-sm text-foreground">Per capire come utilizzarla</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">Inizia a sperimentare</h3>
                  <p className="text-sm text-foreground">Con l'applicazione</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">4</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">Consulta la Guida</h3>
                  <p className="text-sm text-foreground">Per idee didattiche</p>
                </div>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <Lightbulb className="mr-3" />
              Suggerimenti per l'Uso
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="font-bold text-education-light mb-4 flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Per Insegnanti
                </h3>
                <p className="text-foreground">
                  Ogni applicazione può essere utilizzata per creare attività coinvolgenti che trasformano l'apprendimento tradizionale in esperienze interattive.
                </p>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="font-bold text-education-light mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Per Studenti
                </h3>
                <p className="text-foreground">
                  Usa questi strumenti per esplorare la storia, praticare il dibattito e sviluppare il pensiero critico.
                </p>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="font-bold text-education-light mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Per Tutti
                </h3>
                <p className="text-foreground">
                  Sperimenta con diverse combinazioni di applicazioni per creare percorsi di apprendimento personalizzati.
                </p>
              </div>
            </div>
          </section>

          {/* Footer Info */}
          <div className="text-center text-gray-400 text-sm">
            <p>Ultimo aggiornamento: Gennaio 2025</p>
            <p className="mt-2">
              Per supporto o domande, visita la nostra{' '}
              <Link to="/about" className="text-education hover:text-education-light underline">
                pagina di supporto
              </Link>
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default TutorialsPage;