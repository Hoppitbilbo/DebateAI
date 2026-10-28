import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { hostKeys } from "./roomApi";

/**
 * The secret key that manages a room: read from the link fragment (#k=…),
 * which browsers never send to the server, and kept in this browser.
 */
export const useHostKey = (roomId: number) => {
  const { hash } = useLocation();
  const [key, setKey] = useState(() => hostKeys.get(roomId));
  useEffect(() => {
    const fromLink = new URLSearchParams(hash.slice(1)).get("k");
    if (fromLink) {
      hostKeys.save(roomId, fromLink);
      setKey(fromLink);
    }
  }, [hash, roomId]);
  return key;
};
