import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ConversationRail({ conversations, activeId, onSelect, onNew }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Button size="sm" className="w-full" onClick={onNew}>
          <MessageSquarePlus className="w-4 h-4 mr-2" />
          New chat
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">No conversations yet.</p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                conversation.id === activeId
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <span className="block truncate">
                {conversation.metadata?.name || 'Conversation'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}