'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatsApi, type OrderChatMessage } from '@/lib/api/chats';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export default function OrderChatPanel({ orderId }: { orderId: string }) {
  const user = useAuthStore((s) => s.user);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastErrorAtRef = useRef(0);
  const queryClient = useQueryClient();

  const canChat = Boolean(user);
  const queryKey = useMemo(() => ['order-chat', orderId], [orderId]);
  const messagesQuery = useQuery({
    queryKey,
    queryFn: async () => (await chatsApi.getOrderMessages(orderId, { limit: 100 })).data.data ?? [],
    enabled: Boolean(orderId && canChat),
    refetchInterval: 3000,
  });
  const messages = messagesQuery.data ?? [];
  const isInitialLoading = messagesQuery.isLoading && messages.length === 0;

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

  const mySenderId = user?.id;

  const onSend = async () => {
    if (!content.trim()) return;
    if (!canChat || !mySenderId) return;

    setSending(true);
    try {
      const response = await chatsApi.sendOrderMessage(orderId, { content: content.trim() });
      setContent('');
      queryClient.setQueryData<OrderChatMessage[]>(queryKey, (current = []) => [...current, response.data.data]);
      void queryClient.invalidateQueries({ queryKey });
    } catch (e: unknown) {
      const msg = (e as ApiError).response?.data?.message ?? 'Gagal mengirim pesan';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const headerLabel = useMemo(() => {
    if (!user) return 'Chat';
    return user.role === 'seller' ? 'Chat dengan pembeli' : 'Chat dengan penjual';
  }, [user]);

  if (!user) {
    return (
      <div className="pk-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--pk-text-hint)', fontWeight: 600, marginBottom: 8 }}>
          {headerLabel}
        </div>
        <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)' }}>Harap login untuk menggunakan chat.</div>
      </div>
    );
  }

  return (
    <div className="pk-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {headerLabel}
          </div>
          <div style={{ fontSize: 12, color: 'var(--pk-text-hint)', marginTop: 4 }}>
            Kirim pesan terkait order.
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--pk-text-hint)' }}>{isInitialLoading ? 'Memuat...' : `${messages.length} pesan`}</div>
      </div>

      <div
        ref={listRef}
        style={{
          border: '1px solid var(--pk-border)',
          borderRadius: 10,
          padding: 12,
          height: 260,
          overflowY: 'auto',
          background: 'var(--pk-bg-subtle)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--pk-text-hint)', fontSize: 13, paddingTop: 60 }}>
            Belum ada pesan. Mulai diskusi sekarang.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m) => {
              const isMine = mySenderId === m.sender_id;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
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
                    <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>
                      {new Date(m.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}
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
          onChange={(e) => setContent(e.target.value)}
          placeholder="Tulis pesan..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          maxLength={2000}
          rows={2}
          style={{ flex: 1, minHeight: 44, resize: 'none' }}
        />
        <button className="pk-btn pk-btn-primary" disabled={sending || content.trim().length === 0} onClick={() => void onSend()}>
          {sending ? 'Mengirim...' : 'Kirim'}
        </button>
      </div>
    </div>
  );
}

