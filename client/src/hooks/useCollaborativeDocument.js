/**
 * hooks/useCollaborativeDocument.js
 * -----------------------------------------------------------------------------
 * The client-side sync engine. Everything the Editor needs to be collaborative.
 *
 * WHAT IT DOES
 *   1. Joins the document room and builds a local CRDTDocument from the snapshot.
 *   2. Local edits: diff the textarea -> CRDT ops -> emit `document-operation`.
 *   3. Remote edits: apply inbound `document-updated` ops, re-render, and keep
 *      the local caret in the right place.
 *   4. OFFLINE OUTBOX: while disconnected, ops queue locally; on reconnect we
 *      pull missed ops (`sync-missed-operations`) THEN flush the outbox. Server +
 *      client dedup make this safe (at-least-once delivery).
 *   5. Presence: roster, remote cursors, typing — on the separate channel.
 *
 * WHY A HOOK
 *   Keeps all the stateful socket/CRDT wiring out of the view. The Editor just
 *   renders what this returns and calls onChange/onCursor.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import CRDTDocument from '../crdt/CRDTDocument';
import { computeDiff, adjustCaret } from '../utils/diff';
import { getSocket } from '../socket/socket';
import { useAuth } from '../context/AuthContext';

export function useCollaborativeDocument(documentId, textareaRef) {
  const { user } = useAuth();

  // --- Stable identity for this editing session (per-tab CRDT site). ---------
  const siteIdRef = useRef(`${user.id}:${Math.random().toString(36).slice(2, 8)}`);
  const crdtRef = useRef(null);
  const lastVersionRef = useRef(0);
  const outboxRef = useRef([]); // ops awaiting send (offline queue)
  const textRef = useRef('');
  const pendingCaretRef = useRef(null); // caret to restore after a remote edit
  const typingTimerRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [text, setText] = useState('');
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState('connecting'); // connecting | online | offline
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({}); // userId -> { cursorPosition, name, color }
  const [typing, setTyping] = useState({}); // userId -> name

  const setBothText = useCallback((value) => {
    textRef.current = value;
    setText(value);
  }, []);

  // Restore the caret after a remote-driven text change (controlled <textarea>).
  useLayoutEffect(() => {
    if (pendingCaretRef.current != null && textareaRef.current) {
      const pos = pendingCaretRef.current;
      pendingCaretRef.current = null;
      try {
        textareaRef.current.setSelectionRange(pos, pos);
      } catch {
        /* element may be unmounting */
      }
    }
  });

  // --- Outbox flush ----------------------------------------------------------
  const flushOutbox = useCallback(
    (socket) => {
      if (!socket || !socket.connected || outboxRef.current.length === 0) return;
      const batch = outboxRef.current;
      outboxRef.current = [];
      socket.emit('document-operation', { documentId, operations: batch }, (ack) => {
        if (ack && ack.ok) {
          lastVersionRef.current = ack.version;
          setVersion(ack.version);
        } else {
          // Re-queue on failure so nothing is lost.
          outboxRef.current.unshift(...batch);
        }
      });
    },
    [documentId]
  );

  // --- Join + (re)sync, run on first mount and on every reconnect. -----------
  const joinAndSync = useCallback(
    (socket) => {
      socket.emit('join-document', { documentId }, (res) => {
        if (!res || !res.ok) return;
        if (!crdtRef.current) {
          crdtRef.current = CRDTDocument.fromCharacters(siteIdRef.current, res.snapshot);
          setBothText(crdtRef.current.getText());
        }
        lastVersionRef.current = Math.max(lastVersionRef.current, res.version || 0);
        setVersion(lastVersionRef.current);
        setReady(true);

        // Pull anything we missed while away, then push our queued edits.
        socket.emit(
          'sync-missed-operations',
          { documentId, sinceVersion: lastVersionRef.current },
          (sync) => {
            if (sync && sync.ok && sync.operations.length) {
              const before = textRef.current;
              sync.operations.forEach((op) => crdtRef.current.applyRemote(op));
              const after = crdtRef.current.getText();
              const { index, removed, inserted } = computeDiff(before, after);
              if (textareaRef.current) {
                pendingCaretRef.current = adjustCaret(
                  textareaRef.current.selectionStart || 0,
                  index,
                  removed,
                  inserted.length
                );
              }
              setBothText(after);
            }
            if (sync && sync.ok) {
              lastVersionRef.current = Math.max(lastVersionRef.current, sync.version || 0);
              setVersion(lastVersionRef.current);
            }
            flushOutbox(socket);
          }
        );
      });

      socket.emit('presence-join', { documentId }, (res) => {
        if (res && res.ok) setUsers(res.users);
      });
    },
    [documentId, flushOutbox, setBothText, textareaRef]
  );

  // --- Wire up the socket lifecycle + event handlers. ------------------------
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setStatus('offline');
      return undefined;
    }

    const onConnect = () => {
      setStatus('online');
      joinAndSync(socket);
    };
    const onDisconnect = () => setStatus('offline');

    const onDocumentUpdated = ({ operations, version: v }) => {
      if (!crdtRef.current) return;
      const before = textRef.current;
      operations.forEach((op) => crdtRef.current.applyRemote(op));
      const after = crdtRef.current.getText();
      if (after !== before) {
        const { index, removed, inserted } = computeDiff(before, after);
        if (textareaRef.current) {
          pendingCaretRef.current = adjustCaret(
            textareaRef.current.selectionStart || 0,
            index,
            removed,
            inserted.length
          );
        }
        setBothText(after);
      }
      if (v) {
        lastVersionRef.current = Math.max(lastVersionRef.current, v);
        setVersion(lastVersionRef.current);
      }
    };

    const onPresenceState = ({ users: u }) => setUsers(u);
    const onCursor = ({ userId, name, color, cursorPosition }) =>
      setCursors((prev) => ({ ...prev, [userId]: { name, color, cursorPosition } }));
    const onTyping = ({ userId, name, isTyping }) =>
      setTyping((prev) => {
        const next = { ...prev };
        if (isTyping) next[userId] = name;
        else delete next[userId];
        return next;
      });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('document-updated', onDocumentUpdated);
    socket.on('presence-state', onPresenceState);
    socket.on('cursor-update', onCursor);
    socket.on('typing', onTyping);

    // If already connected (AuthContext connected after login), join now.
    if (socket.connected) {
      setStatus('online');
      joinAndSync(socket);
    }

    return () => {
      socket.emit('leave-document', { documentId });
      socket.emit('presence-leave', { documentId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('document-updated', onDocumentUpdated);
      socket.off('presence-state', onPresenceState);
      socket.off('cursor-update', onCursor);
      socket.off('typing', onTyping);
    };
  }, [documentId, joinAndSync, setBothText, textareaRef]);

  // --- Local edit: diff -> CRDT ops -> emit/queue. ---------------------------
  const onChange = useCallback(
    (newText, caret) => {
      const crdt = crdtRef.current;
      if (!crdt) return;
      const { index, removed, inserted } = computeDiff(textRef.current, newText);
      if (removed === 0 && inserted === '') return;

      const ops = [];
      for (let i = 0; i < removed; i++) {
        const op = crdt.localDelete(index);
        if (op) ops.push(op);
      }
      for (let i = 0; i < inserted.length; i++) {
        ops.push(crdt.localInsert(index + i, inserted[i]));
      }
      setBothText(newText);

      const socket = getSocket();
      outboxRef.current.push(...ops);
      flushOutbox(socket);

      // Presence: cursor + typing (debounced stop).
      emitCursor(caret);
      emitTyping(true);
    },
    [flushOutbox, setBothText] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const emitCursor = useCallback(
    (caret) => {
      const socket = getSocket();
      if (socket && socket.connected) socket.emit('cursor-update', { documentId, cursorPosition: caret });
    },
    [documentId]
  );

  const emitTyping = useCallback(
    (isTyping) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;
      socket.emit('typing', { documentId, isTyping });
      if (isTyping) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          socket.emit('typing', { documentId, isTyping: false });
        }, 1500);
      }
    },
    [documentId]
  );

  return {
    ready,
    text,
    version,
    status,
    users,
    cursors,
    typing,
    siteId: siteIdRef.current,
    onChange,
    onCursor: emitCursor,
  };
}
