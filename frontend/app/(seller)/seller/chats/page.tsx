'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Avatar from '@/components/pk/avatar';
import Icon from '@/components/pk/icon';
import ProductChatPanel from '@/components/pk/product-chat-panel';
import ProductImage from '@/components/pk/product-image';
import { chatsApi } from '@/lib/api/chats';
import { formatIDR } from '@/lib/format';
import { useAuthStore } from '@/store/auth';

export default function SellerChatsPage() {
  const user = useAuthStore((state) => state.user);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const threadsQuery = useQuery({
    queryKey: ['product-chat', 'threads'],
    queryFn: async () => (await chatsApi.getProductThreads()).data.data ?? [],
    enabled: Boolean(user?.id),
    refetchInterval: 10_000,
  });

  const threads = useMemo(() => threadsQuery.data ?? [], [threadsQuery.data]);
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null,
    [selectedId, threads]
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>Chat Produk</h1>
          <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)' }}>
            Jawab pertanyaan buyer sebelum mereka checkout.
          </div>
        </div>
        <Link href="/seller/products" className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
          <Icon name="box" size={14} />
          Produk
        </Link>
      </div>

      {threadsQuery.isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--pk-text-hint)' }}>Memuat chat...</div>
      ) : threads.length === 0 ? (
        <div className="pk-card" style={{ padding: 32, textAlign: 'center', background: '#fff' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--pk-bg-subtle)', margin: '0 auto 12px' }}>
            <Icon name="message" size={20} />
          </div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Belum ada chat produk</div>
          <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)' }}>
            Thread akan muncul saat buyer menekan tombol Chat Penjual di halaman produk Anda.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <div className="pk-card" style={{ background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--pk-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pk-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Thread Aktif
              </div>
              <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', marginTop: 4 }}>
                {threads.length} percakapan
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
              {threads.map((thread) => {
                const isSelected = selectedThread?.id === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedId(thread.id)}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: 14,
                      border: 'none',
                      borderBottom: '1px solid var(--pk-border)',
                      background: isSelected ? 'var(--pk-bg-subtle)' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <ProductImage
                      src={thread.product?.image_url ?? null}
                      alt={thread.product?.name ?? 'Produk'}
                      height={48}
                      style={{ width: 48, borderRadius: 8, flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <Avatar name={thread.buyer?.name || 'Buyer'} size={22} bg="#F3F4F6" color="#111827" />
                        <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {thread.buyer?.name || 'Buyer'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {thread.product?.name || 'Produk'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--pk-text-hint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                        {thread.last_message?.content || 'Belum ada pesan'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedThread && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <div className="pk-card" style={{ padding: 16, background: '#fff', display: 'flex', gap: 12, alignItems: 'center' }}>
                <ProductImage
                  src={selectedThread.product?.image_url ?? null}
                  alt={selectedThread.product?.name ?? 'Produk'}
                  height={54}
                  style={{ width: 54, borderRadius: 8, flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{selectedThread.product?.name || 'Produk'}</div>
                  <div style={{ fontSize: 12, color: 'var(--pk-text-secondary)', marginTop: 3 }}>
                    {selectedThread.product ? formatIDR(selectedThread.product.price) : '-'}
                  </div>
                </div>
                {selectedThread.product?.id && (
                  <Link href={`/products/${selectedThread.product.id}`} className="pk-btn pk-btn-secondary pk-btn-sm" style={{ textDecoration: 'none' }}>
                    Lihat Produk
                  </Link>
                )}
              </div>
              <ProductChatPanel
                threadId={selectedThread.id}
                title={`Chat dengan ${selectedThread.buyer?.name || 'Buyer'}`}
                subtitle={selectedThread.product?.name || undefined}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
