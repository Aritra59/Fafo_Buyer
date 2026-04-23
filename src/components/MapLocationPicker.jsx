import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { searchPlaces } from "../services/nominatim";

function fixLeafletDefaultIcons() {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL(
      "leaflet/dist/images/marker-icon-2x.png",
      import.meta.url
    ).toString(),
    iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
    shadowUrl: new URL(
      "leaflet/dist/images/marker-shadow.png",
      import.meta.url
    ).toString(),
  });
}

function MapViewSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function ClickSelect({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const DEFAULT_CENTER = [12.9716, 77.5946];
const DEFAULT_ZOOM = 13;

/**
 * @param {{
 *   value: { lat: number, lng: number } | null,
 *   address: string,
 *   onChange: (next: { lat: number, lng: number, address: string }) => void,
 * }} props
 */
function MapLocationPicker({ value, address, onChange }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef(0);
  const abortRef = useRef(null);

  const lat = value?.lat ?? DEFAULT_CENTER[0];
  const lng = value?.lng ?? DEFAULT_CENTER[1];
  const center = useMemo(() => [lat, lng], [lat, lng]);

  useEffect(() => {
    fixLeafletDefaultIcons();
  }, []);

  const applyPick = useCallback(
    (nextLat, nextLng, nextAddress) => {
      onChange({
        lat: nextLat,
        lng: nextLng,
        address: nextAddress ?? address,
      });
    },
    [onChange, address]
  );

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchError("");
      return undefined;
    }

    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setSearching(true);
      setSearchError("");
      try {
        const results = await searchPlaces(q, ac.signal);
        setSuggestions(results);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setSearchError(e instanceof Error ? e.message : "Search failed");
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="nb-map-picker">
      <div className="nb-map-picker__search">
        <label className="nb-field" htmlFor="loc-search">
          <span className="nb-field__label">Search place</span>
          <input
            id="loc-search"
            className="nb-input"
            placeholder="Search area, landmark, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        {searching ? (
          <p className="nb-hint nb-hint--muted">Searching…</p>
        ) : null}
        {searchError ? (
          <p className="nb-field__error">{searchError}</p>
        ) : null}
        {suggestions.length > 0 ? (
          <ul className="nb-suggest" role="listbox">
            {suggestions.map((s, i) => (
              <li key={`${s.lat}-${s.lng}-${i}`}>
                <button
                  type="button"
                  className="nb-suggest__btn"
                  onClick={() => {
                    applyPick(s.lat, s.lng, s.label);
                    setQuery("");
                    setSuggestions([]);
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="nb-map-picker__map">
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          style={{ height: "260px", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewSync center={center} zoom={DEFAULT_ZOOM} />
          <ClickSelect
            onPick={(la, ln) => {
              applyPick(la, ln, address);
            }}
          />
          <Marker
            position={[lat, lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const m = e.target;
                const p = m.getLatLng();
                applyPick(p.lat, p.lng, address);
              },
            }}
          />
        </MapContainer>
      </div>
      <p className="nb-hint">
        Tap the map or drag the pin to fine-tune. Pick a search result to
        autofill the address.
      </p>
    </div>
  );
}

export default MapLocationPicker;
export { MapLocationPicker };
