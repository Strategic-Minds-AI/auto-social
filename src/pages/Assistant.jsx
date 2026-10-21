import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquarePlus } from 'lucide-react';
import ChatBubble from '@/components/assistant/ChatBubble';
import EdenAvatar from '@/components/assistant/EdenAvatar';
import ConversationRail from '@/components/assistant/ConversationRail';

const AGENT = 'social_assistant';

export default function Assistant() {
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  const refreshList = async () => {
    const result = await base44.agents.listConversations({ agent_name: AGENT });
    const items = Array.isArray(result) ? result : result?.items || [];
    setConversations(items);
    return items;
  };

  const openConversation = async (id) => {
    const loaded = await base44.agents.getConversation(id);
    setConversation(loaded);
    setMessages(loaded?.messages || []);
  };

  const startConversation = async () => {
    const created = await base44.agents.createConversation({
      agent_name: AGENT,
      metadata: { name: 'New conversation', description: 'Eden Skye' },
    });
    setConversation(created);
    setMessages(created?.messages || []);
    await refreshList();
  };

  useEffect(() => {
    let cancelled = false;
    refreshList()
      .then((items) => {
        if (!cancelled && items.length) return openConversation(items[0].id);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data?.messages || []);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !conversation?.id || sending) return;
    setSending(true);
    setInput('');
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: text });
      await refreshList();
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen">
      <aside className="hidden lg:flex w-64 border-r border-border bg-card flex-col shrink-0">
        <ConversationRail
          conversations={conversations}
          activeId={conversation?.id}
          onSelect={openConversation}
          onNew={startConversation}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <EdenAvatar className="w-10 h-10" />
            <div className="min-w-0">
              <p className="font-space font-semibold truncate">Eden Skye</p>
              <p className="text-xs text-muted-foreground">Executive AI assistant</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="lg:hidden" onClick={startConversation}>
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-5 space-y-4">
          {!conversation ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <EdenAvatar className="w-16 h-16 mb-4" />
              <h2 className="font-space font-semibold">Talk to Eden Skye</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
                Ask what is going out this week, what still needs your review, or have her draft something new.
              </p>
              <Button onClick={startConversation}>New chat</Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground max-w-sm">
                Say hello, or ask "What is scheduled this week?"
              </p>
            </div>
          ) : (
            messages.map((message, index) => <ChatBubble key={index} message={message} />)
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSend} className="border-t border-border p-4 flex items-center gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={conversation ? 'Ask anything about your content...' : 'Start a chat first'}
            disabled={!conversation || sending}
          />
          <Button type="submit" size="icon" disabled={!conversation || sending || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}