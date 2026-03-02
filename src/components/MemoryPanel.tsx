'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Memory, MemoryCategory } from '@/types';

interface Props {
  onClose: () => void;
  onMemoryCountChange?: (count: number) => void;
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  race_event: 'Race Event',
  goal: 'Goal',
  injury: 'Injury',
  training_context: 'Training',
  personal: 'Personal',
};

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  race_event: 'bg-garmin-blue text-white',
  goal: 'bg-garmin-green text-garmin-bg',
  injury: 'bg-red-500 text-white',
  training_context: 'bg-purple-500 text-white',
  personal: 'bg-garmin-surface-2 text-garmin-text-muted',
};

export default function MemoryPanel({ onClose, onMemoryCountChange }: Props) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<MemoryCategory>('personal');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    const sessionToken = sessionStorage.getItem('garmin_session') ?? '';
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/memories?session_token=${encodeURIComponent(sessionToken)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { memories: Memory[] };
      const mems = data.memories ?? [];
      setMemories(mems);
      onMemoryCountChange?.(mems.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [onMemoryCountChange]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  function startEdit(m: Memory) {
    setEditingId(m.id);
    setEditKey(m.key);
    setEditContent(m.content);
    setEditCategory(m.category);
  }

  async function saveEdit(id: string) {
    const sessionToken = sessionStorage.getItem('garmin_session') ?? '';
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          key: editKey,
          content: editContent,
          category: editCategory,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingId(null);
      fetchMemories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update memory');
    }
  }

  async function confirmDelete(id: string) {
    const sessionToken = sessionStorage.getItem('garmin_session') ?? '';
    try {
      const res = await fetch(
        `/api/memories/${id}?session_token=${encodeURIComponent(sessionToken)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfirmDeleteId(null);
      fetchMemories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Coach's Memory"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-garmin-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-garmin-border px-6 py-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-garmin-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h2 className="text-lg font-semibold text-garmin-text">Coach&apos;s Memory</h2>
            {memories.length > 0 && (
              <span className="rounded-full bg-garmin-blue px-2 py-0.5 text-xs font-medium text-white">
                {memories.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close memory panel"
            className="text-garmin-text-muted hover:text-garmin-text"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-garmin-text-muted">Loading memories…</p>
          ) : error ? (
            <p className="text-center text-red-400">{error}</p>
          ) : memories.length === 0 ? (
            <p className="text-center text-sm text-garmin-text-muted">
              No memories yet. Start a conversation and I&apos;ll remember relevant details
              automatically.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {memories.map((m) =>
                editingId === m.id ? (
                  <li
                    key={m.id}
                    className="rounded-xl border border-garmin-blue bg-garmin-surface-2 p-4"
                  >
                    <input
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      placeholder="Label"
                      className="mb-2 w-full rounded-lg border border-garmin-border bg-garmin-bg px-3 py-2 text-sm text-garmin-text focus:outline-none focus:ring-1 focus:ring-garmin-blue"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Detail"
                      rows={3}
                      className="mb-2 w-full resize-none rounded-lg border border-garmin-border bg-garmin-bg px-3 py-2 text-sm text-garmin-text focus:outline-none focus:ring-1 focus:ring-garmin-blue"
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                      className="mb-3 w-full rounded-lg border border-garmin-border bg-garmin-bg px-3 py-2 text-sm text-garmin-text focus:outline-none focus:ring-1 focus:ring-garmin-blue"
                    >
                      {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(m.id)}
                        className="rounded-lg bg-garmin-blue px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-garmin-border px-4 py-1.5 text-sm text-garmin-text-muted hover:text-garmin-text"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ) : confirmDeleteId === m.id ? (
                  <li
                    key={m.id}
                    className="rounded-xl border border-red-500 bg-garmin-surface-2 p-4"
                  >
                    <p className="mb-3 text-sm text-garmin-text">
                      Delete <strong>&quot;{m.key}&quot;</strong>? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmDelete(m.id)}
                        className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-garmin-border px-4 py-1.5 text-sm text-garmin-text-muted hover:text-garmin-text"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-garmin-border bg-garmin-surface-2 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-garmin-text">{m.key}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[m.category]}`}
                        >
                          {CATEGORY_LABELS[m.category]}
                        </span>
                      </div>
                      <p className="text-sm text-garmin-text-muted">{m.content}</p>
                      <p className="mt-1 text-xs text-garmin-text-muted">
                        Saved {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => startEdit(m)}
                        aria-label={`Edit ${m.key}`}
                        className="rounded-lg p-1.5 text-garmin-text-muted hover:text-garmin-text"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(m.id)}
                        aria-label={`Delete ${m.key}`}
                        className="rounded-lg p-1.5 text-garmin-text-muted hover:text-red-400"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
