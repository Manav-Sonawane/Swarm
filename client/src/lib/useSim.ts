import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { EventPayload, PlaceResult, QuoteResult, ScenarioName, SetupConfig, TickPayload } from '../types';

const ACK_TIMEOUT_MS = 4000;

/** Everything the UI needs from the simulation server: the latest tick, the event feed, and every action. */
export function useSim() {
  const [tick, setTick] = useState<TickPayload | null>(null);
  const [events, setEvents] = useState<EventPayload[]>([]);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [placed, setPlaced] = useState<string[]>([]); // ids of orders placed from this browser, newest first
  const lastSeed = useRef<number | null>(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onTick = (data: TickPayload) => {
      // A reset (or a new seed) starts a fresh run: clear feed and the orders placed in the old run
      if (lastSeed.current !== null && (data.seed !== lastSeed.current || data.simTime < (tickTimeRef.current ?? 0) - 5)) {
        setEvents([]);
        setPlaced([]);
      }
      lastSeed.current = data.seed;
      tickTimeRef.current = data.simTime;
      setTick(data);
    };
    const onEvent = (evt: EventPayload) => {
      if (evt.kind === 'SYSTEM_RESET') {
        setEvents([evt]);
        setPlaced([]);
        return;
      }
      setEvents(prev => (prev.length >= 200 ? [...prev.slice(-199), evt] : [...prev, evt]));
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('tick', onTick);
    socket.on('event', onEvent);
    setConnected(socket.connected); // the socket may have connected before these listeners were attached
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('tick', onTick);
      socket.off('event', onEvent);
    };
  }, []);

  const control = useCallback(
    (action: 'play' | 'pause' | 'reset', opts: { speed?: number; seed?: number; setup?: Partial<SetupConfig> } = {}) => {
      socket.emit('control', { action, ...opts });
    },
    []
  );

  const scenario = useCallback((name: ScenarioName) => socket.emit('scenario', { name }), []);

  const quote = useCallback(
    (lat: number, lng: number) =>
      new Promise<QuoteResult>(resolve => {
        socket.timeout(ACK_TIMEOUT_MS).emit('quote', { lat, lng }, (err: unknown, res: QuoteResult) =>
          resolve(err ? { ok: false, reason: 'The simulation server did not answer. Is it running?' } : res)
        );
      }),
    []
  );

  const placeOrder = useCallback(
    (lat: number, lng: number, items: { sku: string; qty: number }[]) =>
      new Promise<PlaceResult>(resolve => {
        socket.timeout(ACK_TIMEOUT_MS).emit('place_order', { lat, lng, items }, (err: unknown, res: PlaceResult) => {
          const r: PlaceResult = err ? { ok: false, reason: 'The simulation server did not answer. Is it running?' } : res;
          if (r.ok) setPlaced(p => [r.orderId, ...p]);
          resolve(r);
        });
      }),
    []
  );

  return { tick, events, connected, placed, control, scenario, quote, placeOrder };
}

const tickTimeRef: { current: number | null } = { current: null };

export type Sim = ReturnType<typeof useSim>;
