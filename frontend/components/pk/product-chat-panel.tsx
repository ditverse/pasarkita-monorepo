'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Icon from '@/components/pk/icon';
import { chatsApi, type ProductChatMessage } from '@/lib/api/chats';
import { useAuthStore } from '@/store/auth';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export default function ProductChatPanel({
  threadId,
  title,
  subtitle,
  onClose,
}: {
  threadId: string;
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastErrorAtRef = useRef(0);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['product-chat', threadId, 'messages'], [threadId]);

  const messagesQuery = useQuery({
    queryKey,
    queryFn: async () => (await chatsApi.getProductMessages(threadId, { limit: 100 })).data.data ?? [],
    enabled: Boolean(threadId && user),
    refetchInterval: 3000,
  });

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    if (!messagesQuery.isError || messagesQuery.errorUpdatedAt === lastErrorAtRef.current) return;
    lastErrorAtRef.current = messagesQuery.errorUpdatedAt;
    const message = (messagesQuery.error as ApiError).response?.data?.message ?? 'Gagal memuat chat';
    toast.error(message);
  }, [messagesQuery.error, messagesQuery.errorUpdatedAt, messagesQuery.isError]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const trimmed = content.trim();
    if (!trimmed || !user) return;

    setSending(true);
    try {
      const response = await chatsApi.sendProductMessage(threadId, { content: trimmed });
      setContent('');
      queryClient.setQueryData<ProductChatMessage[]>(queryKey, (current = []) => [...current, response.data.data]);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['product-chat', 'threads'] });
    } catch (error) {
      const message = (error as ApiError).response?.data?.message ?? 'Gagal mengirim pesan';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pk-card" style={{ padding: 20, background: '#fff', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', marginTop: 4, overflowWrap: 'anywhere' }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>
            {messagesQuery.isLoading && messages.length === 0 ? 'Memuat...' : `${messages.length} pesan`}
          </span>
          {onClose && (
            <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={onClose} aria-label="Tutup chat">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        style={{
          border: '1px solid var(--pk-border)',
          borderRadius: 10,
          padding: 12,
          height: 300,
          overflowY: 'auto',
          background: 'var(--pk-bg-subtle)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--pk-text-hint)', fontSize: 13, paddingTop: 82 }}>
            Belum ada pesan. Mulai percakapan tentang produk ini.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((message) => {
              const isMine = user?.id === message.sender_id;
              return (
                <div key={message.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '78%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: isMine ? 'var(--pk-text)' : '#fff',
                      color: isMine ? '#fff' : 'var(--pk-text)',
                      border: isMine ? 'none' : '1px solid var(--pk-border)',
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {message.content}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>
                      {new Date(message.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <textarea
          className="pk-textarea"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Tulis pesan..."
          maxLength={2000}
          rows={2}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          style={{ flex: 1, minHeight: 44, resize: 'none' }}
        />
        <button type="button" className="pk-btn pk-btn-primary" disabled={sending || content.trim().length === 0} onClick={() => void send()}>
          {sending ? 'Mengirim...' : 'Kirim'}
        </button>
      </div>
    </div>
  );
}
