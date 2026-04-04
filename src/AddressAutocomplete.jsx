/**
 * AddressAutocomplete — Google Places autocomplete for address fields.
 * Loads Google Maps JS API, shows an autocomplete input, and parses
 * the selected place into street, city, state, county fields.
 */
import { useEffect, useRef, useState } from "react";

const API_KEY = "AIzaSyCjmT_f4dyiBO8W8AdhEUq9v3T3J9DAWlQ";

// Load Google Maps JS API once
let loadPromise = null;
function loadGoogleMaps() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Parse a Google Place result into structured address fields
function parsePlace(place) {
  const result = { street: "", city: "", state: "", county: "" };
  if (!place.address_components) return result;

  let streetNumber = "";
  let route = "";

  for (const comp of place.address_components) {
    const type = comp.types[0];
    if (type === "street_number") streetNumber = comp.long_name;
    else if (type === "route") route = comp.long_name;
    else if (type === "locality") result.city = comp.long_name;
    else if (type === "sublocality_level_1" && !result.city) result.city = comp.long_name;
    else if (type === "administrative_area_level_1") result.state = comp.short_name;
    else if (type === "administrative_area_level_2") result.county = comp.long_name.replace(/ County$/i, "");
  }

  result.street = [streetNumber, route].filter(Boolean).join(" ");
  return result;
}

export default function AddressAutocomplete({ street, onAddressParsed, error, label }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [loaded, setLoaded] = useState(!!window.google?.maps?.places);

  useEffect(() => {
    loadGoogleMaps().then(() => setLoaded(true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.address_components) return;
      const parsed = parsePlace(place);
      onAddressParsed(parsed);
    });

    autocompleteRef.current = ac;
  }, [loaded]);

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        ref={inputRef}
        type="text"
        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white transition ${error ? "border-red-400 ring-1 ring-red-300" : "border-gray-300 focus:border-blue-400"}`}
        placeholder="Start typing an address..."
        defaultValue={street}
        onChange={(e) => onAddressParsed({ street: e.target.value })}
      />
    </div>
  );
}
