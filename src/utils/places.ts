/**
 * Province and city lists for the venue form. The Philippines come from the official PSGC list (psgc.gitlab.io), whose city
 * names are right; other countries use the country-state-city package, loaded only when first needed. A lookup that fails or
 * finds nothing gives an empty list, and the form then lets the user type the name instead.
 */

const PSGC = 'https://psgc.gitlab.io/api';
const NCR = { name: 'Metro Manila', region: '130000000' };

type Psgc = { code: string; name: string }[];
const cache = new Map<string, Promise<string[]>>();
let phProvinces: Promise<Psgc> | null = null;

const sorted = (names: string[]) => [...new Set(names)].sort((a, b) => a.localeCompare(b));
const once = (key: string, load: () => Promise<string[]>) => {
  let hit = cache.get(key);
  if (!hit) {
    hit = load().catch(() => []);
    cache.set(key, hit);
  }
  return hit;
};
const getJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return (await res.json()) as Psgc;
};
const loadPhProvinces = () => (phProvinces ??= getJson(`${PSGC}/provinces/`));
const library = () => import('country-state-city');

/** The provinces, states or regions of a country (ISO code). */
export function loadProvinces(iso: string): Promise<string[]> {
  if (!iso) return Promise.resolve([]);
  return once(`p:${iso}`, async () => {
    if (iso === 'PH') return sorted([...(await loadPhProvinces()).map((p) => p.name), NCR.name]);
    const { State } = await library();
    return sorted(State.getStatesOfCountry(iso).map((s) => s.name));
  });
}

/** The cities of a province or state of a country. */
export function loadCities(iso: string, province: string): Promise<string[]> {
  if (!iso || !province) return Promise.resolve([]);
  return once(`c:${iso}:${province}`, async () => {
    if (iso === 'PH') {
      const url =
        province === NCR.name
          ? `${PSGC}/regions/${NCR.region}/cities-municipalities/`
          : await loadPhProvinces().then((all) => {
              const found = all.find((p) => p.name === province);
              if (!found) throw new Error('unknown province');
              return `${PSGC}/provinces/${found.code}/cities-municipalities/`;
            });
      return sorted((await getJson(url)).map((c) => c.name));
    }
    const { State, City } = await library();
    const state = State.getStatesOfCountry(iso).find((s) => s.name === province);
    return state ? sorted(City.getCitiesOfState(iso, state.isoCode).map((c) => c.name)) : [];
  });
}
