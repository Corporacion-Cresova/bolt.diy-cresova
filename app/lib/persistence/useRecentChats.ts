import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getAll, deleteById } from './db';
import { db } from './useChatHistory';

/**
 * A finished (or in-progress) build, as shown in the projects rail and the
 * projects gallery. This is the chat history rendered as "projects" — the same
 * data the sidebar menu lists, just presented as cards instead of a list.
 */
export interface RecentChatSummary {
  id: string;
  urlId: string;
  description: string;
  timestamp: string;
}

interface UseRecentChatsOptions {
  limit?: number;
}

export function useRecentChats({ limit }: UseRecentChatsOptions = {}) {
  const [chats, setChats] = useState<RecentChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    getAll(db)
      .then((list) =>
        list
          .filter((item): item is typeof item & { urlId: string; description: string } =>
            Boolean(item.urlId && item.description),
          )
          .map(({ id, urlId, description, timestamp }) => ({ id, urlId, description, timestamp }))
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
      )
      .then((list) => setChats(limit ? list.slice(0, limit) : list))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  const removeChat = useCallback(
    async (id: string) => {
      if (!db) {
        return;
      }

      try {
        localStorage.removeItem(`snapshot:${id}`);
      } catch (error) {
        console.error(`Error deleting snapshot for chat ${id}:`, error);
      }

      try {
        await deleteById(db, id);
        setChats((current) => current.filter((chat) => chat.id !== id));
      } catch (error) {
        console.error('Failed to delete chat:', error);
        toast.error('No se pudo eliminar el proyecto');
      }
    },
    [setChats],
  );

  return { chats, loading, removeChat, reload: load };
}
