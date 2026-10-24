import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Metro Manila, where the map opens when there is no pin yet.
const START: [number, number] = [14.5995, 120.9842];

type Found = { name: string; lat: number; lng: number };

/** A map to drop a pin on: click to place it, drag it to adjust, or search for a place or use the current location. `position` is null while there is no pin. */
export function MapPinPicker({ position, onChange }: { position: { lat: number; lng: number } | null; onChange: (next: { lat: number; lng: number } | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Pins the spot and moves the map to it. */
  function go(lat: number, lng: number, zoom = 17) {
    place(lat, lng);
    map.current?.setView([lat, lng], zoom);
    latest.current({ lat, lng });
  }
  async function search(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // the venue form around this must not be submitted
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setNote(null);
    setFound(null);
    try {
      const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=' + encodeURIComponent(q));
      if (!res.ok) throw new Error('search failed');
      const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      const list = rows.map((r) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
      if (list.length === 0) setNote('No place found. Try a street, a landmark or a city.');
      else setFound(list);
    } catch {
      setNote('The search could not be reached. Click the map to pin the place instead.');
    } finally {
      setBusy(false);
    }
  }
  function useMyLocation() {
    if (!navigator.geolocation) return setNote('This browser cannot share your location.');
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => go(pos.coords.latitude, pos.coords.longitude),
      () => setNote('Your location was not shared. Allow location access for this site, or search for the place.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function place(lat: number, lng: number) {
    const m = map.current;
    if (!m) return;
    if (pin.current) pin.current.setLatLng([lat, lng]);
    else {
      pin.current = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [26, 34], iconAnchor: [13, 34] }),
      }).addTo(m);
      pin.current.on('dragend', () => {
        const at = pin.current!.getLatLng();
        latest.current({ lat: at.lat, lng: at.lng });
      });
    }
  }

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { center: position ? [position.lat, position.lng] : START, zoom: position ? 15 : 12, zoomControl: false });
    L.control.zoom({ position: 'bottomleft' }).addTo(m); // the search box spans the top
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
    map.current = m;
    if (position) place(position.lat, position.lng);
    m.on('click', (e: L.LeafletMouseEvent) => {
      place(e.latlng.lat, e.latlng.lng);
      latest.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    // The window it sits in is still opening, so the map measures itself again once it has its size.
    const watch = new ResizeObserver(() => m.invalidateSize());
    watch.observe(box.current);
    return () => {
      watch.disconnect();
      m.remove();
      map.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pin removed from outside takes it off the map.
  useEffect(() => {
    if (!position && pin.current) {
      pin.current.remove();
      pin.current = null;
    }
  }, [position]);

  return (
    <div className="map-picker">
      <div className="map-picker-frame">
        <div ref={box} className="map-picker-map" role="application" aria-label="Map: click to drop a pin on the venue" />
        <div className="map-picker-search">
          <div className="map-picker-searchrow">
            <input
              type="search"
              value={query}
              placeholder="Search a place or address"
              aria-label="Search the map"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search(e as unknown as React.FormEvent);
              }}
            />
            <button type="button" className="btn btn-sm" disabled={busy || !query.trim()} onClick={(e) => void search(e)}>
              {busy ? '…' : 'Search'}
            </button>
          </div>
          {note && <p className="map-picker-note">{note}</p>}
          {found && (
            <ul className="map-picker-results">
              {found.map((f) => (
                <li key={`${f.lat},${f.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      go(f.lat, f.lng);
                      setFound(null);
                    }}
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="map-picker-locate" onClick={useMyLocation} title="Pin where you are now" aria-label="Use my current location">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.5" />
            <circle cx="12" cy="12" r="8" />
            <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
          </svg>
        </button>
      </div>
      <div className="map-picker-bar">
        <span className="muted small">{position ? `Pinned at ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Click the map to drop a pin on the venue (optional).'}</span>
        {position && (
          <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>
            Remove pin
          </button>
        )}
      </div>
    </div>
  );
}
