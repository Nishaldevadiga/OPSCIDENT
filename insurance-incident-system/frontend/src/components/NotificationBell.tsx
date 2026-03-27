import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../services/api';
import type { InAppNotification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';

const POLL_INTERVAL = 30_000; // 30 seconds

const typeIcon: Record<string, React.ElementType> = {
  claim_submitted: DocumentTextIcon,
  claim_approved: CheckCircleIcon,
  claim_rejected: XCircleIcon,
  info_requested: ExclamationTriangleIcon,
  appeal_received: ArrowPathIcon,
  appeal_decided: ArrowPathIcon,
  status_changed: DocumentTextIcon,
};

const typeColor: Record<string, string> = {
  claim_submitted: 'text-sky-400 bg-sky-500/10',
  claim_approved: 'text-emerald-400 bg-emerald-500/10',
  claim_rejected: 'text-rose-400 bg-rose-500/10',
  info_requested: 'text-orange-400 bg-orange-500/10',
  appeal_received: 'text-violet-400 bg-violet-500/10',
  appeal_decided: 'text-violet-400 bg-violet-500/10',
  status_changed: 'text-slate-400 bg-slate-500/10',
};

interface Props {
  isAgent?: boolean;
}

export default function NotificationBell({ isAgent = false }: Props) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const navigate = useNavigate();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationsApi.unreadCount();
      setUnreadCount(count);
    } catch {
      // silently ignore — user may have logged out
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await notificationsApi.list();
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Poll unread count every 30 s
  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  // Load full list and compute position when panel opens
  useEffect(() => {
    if (open) {
      fetchList();
      if (bellRef.current) {
        const rect = bellRef.current.getBoundingClientRect();
        setPanelPos({
          top: rect.bottom + window.scrollY + 8,
          right: window.innerWidth - rect.right,
        });
      }
    }
  }, [open, fetchList]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const outsideBell = bellRef.current && !bellRef.current.contains(target);
      const outsidePanel = panelRef.current && !panelRef.current.contains(target);
      if (outsideBell && outsidePanel) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      await notificationsApi.markRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (notif.ticket) {
      navigate(isAgent ? `/agent/tickets/${notif.ticket}` : `/tickets/${notif.ticket}`);
    }
  };

  const displayed = notifications.slice(0, 8);

  return (
    <div ref={bellRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellSolidIcon className="h-5 w-5 text-primary-400" />
        ) : (
          <BellIcon className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — rendered in a portal to escape nav stacking context */}
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'absolute', top: panelPos.top, right: panelPos.right }}
          className="w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-10">
                <BellIcon className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {displayed.map((notif) => {
                  const Icon = typeIcon[notif.notification_type] ?? DocumentTextIcon;
                  const colorClass = typeColor[notif.notification_type] ?? 'text-slate-400 bg-slate-500/10';
                  return (
                    <li key={notif.id}>
                      <button
                        onClick={() => handleClick(notif)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors border-b border-slate-800 last:border-0 ${
                          !notif.is_read ? 'bg-slate-800/30' : ''
                        }`}
                      >
                        {/* Icon */}
                        <span className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-medium truncate ${notif.is_read ? 'text-slate-300' : 'text-slate-100'}`}>
                              {notif.title}
                            </p>
                            {!notif.is_read && (
                              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-400" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {notifications.length > 8 && (
            <div className="px-4 py-2.5 border-t border-slate-700 text-center">
              <p className="text-xs text-slate-500">{notifications.length - 8} older notifications not shown</p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
