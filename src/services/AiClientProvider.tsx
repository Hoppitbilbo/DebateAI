import type { ReactNode } from "react";
import { AiClient, AiClientContext } from "./aiClient";

/** Provides another AiClient to the tree below (the app uses httpAiClient by default). */
const AiClientProvider = ({ client, children }: { client: AiClient; children: ReactNode }) => (
  <AiClientContext.Provider value={client}>{children}</AiClientContext.Provider>
);

export default AiClientProvider;
