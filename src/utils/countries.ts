// Countries with their international dialling codes, for the phone field. Format: "ISO name dial".
const RAW = `
AF Afghanistan 93|AL Albania 355|DZ Algeria 213|AD Andorra 376|AO Angola 244|AR Argentina 54|AM Armenia 374
AU Australia 61|AT Austria 43|AZ Azerbaijan 994|BS Bahamas 1242|BH Bahrain 973|BD Bangladesh 880|BB Barbados 1246
BY Belarus 375|BE Belgium 32|BZ Belize 501|BJ Benin 229|BT Bhutan 975|BO Bolivia 591|BA Bosnia and Herzegovina 387
BW Botswana 267|BR Brazil 55|BN Brunei 673|BG Bulgaria 359|BF Burkina Faso 226|BI Burundi 257|KH Cambodia 855
CM Cameroon 237|CA Canada 1|CV Cape Verde 238|CF Central African Republic 236|TD Chad 235|CL Chile 56|CN China 86
CO Colombia 57|KM Comoros 269|CG Congo 242|CD DR Congo 243|CR Costa Rica 506|CI Côte d'Ivoire 225|HR Croatia 385
CU Cuba 53|CY Cyprus 357|CZ Czechia 420|DK Denmark 45|DJ Djibouti 253|DO Dominican Republic 1809|EC Ecuador 593
EG Egypt 20|SV El Salvador 503|GQ Equatorial Guinea 240|ER Eritrea 291|EE Estonia 372|SZ Eswatini 268|ET Ethiopia 251
FJ Fiji 679|FI Finland 358|FR France 33|GA Gabon 241|GM Gambia 220|GE Georgia 995|DE Germany 49|GH Ghana 233
GR Greece 30|GT Guatemala 502|GN Guinea 224|GY Guyana 592|HT Haiti 509|HN Honduras 504|HK Hong Kong 852|HU Hungary 36
IS Iceland 354|IN India 91|ID Indonesia 62|IR Iran 98|IQ Iraq 964|IE Ireland 353|IL Israel 972|IT Italy 39
JM Jamaica 1876|JP Japan 81|JO Jordan 962|KZ Kazakhstan 7|KE Kenya 254|KW Kuwait 965|KG Kyrgyzstan 996|LA Laos 856
LV Latvia 371|LB Lebanon 961|LS Lesotho 266|LR Liberia 231|LY Libya 218|LI Liechtenstein 423|LT Lithuania 370
LU Luxembourg 352|MO Macau 853|MG Madagascar 261|MW Malawi 265|MY Malaysia 60|MV Maldives 960|ML Mali 223|MT Malta 356
MR Mauritania 222|MU Mauritius 230|MX Mexico 52|MD Moldova 373|MC Monaco 377|MN Mongolia 976|ME Montenegro 382
MA Morocco 212|MZ Mozambique 258|MM Myanmar 95|NA Namibia 264|NP Nepal 977|NL Netherlands 31|NZ New Zealand 64
NI Nicaragua 505|NE Niger 227|NG Nigeria 234|KP North Korea 850|MK North Macedonia 389|NO Norway 47|OM Oman 968
PK Pakistan 92|PS Palestine 970|PA Panama 507|PG Papua New Guinea 675|PY Paraguay 595|PE Peru 51|PH Philippines 63
PL Poland 48|PT Portugal 351|PR Puerto Rico 1787|QA Qatar 974|RO Romania 40|RU Russia 7|RW Rwanda 250|SA Saudi Arabia 966
SN Senegal 221|RS Serbia 381|SC Seychelles 248|SL Sierra Leone 232|SG Singapore 65|SK Slovakia 421|SI Slovenia 386
SB Solomon Islands 677|SO Somalia 252|ZA South Africa 27|KR South Korea 82|SS South Sudan 211|ES Spain 34|LK Sri Lanka 94
SD Sudan 249|SR Suriname 597|SE Sweden 46|CH Switzerland 41|SY Syria 963|TW Taiwan 886|TJ Tajikistan 992|TZ Tanzania 255
TH Thailand 66|TL Timor-Leste 670|TG Togo 228|TT Trinidad and Tobago 1868|TN Tunisia 216|TR Türkiye 90|TM Turkmenistan 993
UG Uganda 256|UA Ukraine 380|AE United Arab Emirates 971|GB United Kingdom 44|US United States 1|UY Uruguay 598
UZ Uzbekistan 998|VU Vanuatu 678|VE Venezuela 58|VN Vietnam 84|YE Yemen 967|ZM Zambia 260|ZW Zimbabwe 263
`;

export interface Country {
  iso: string;
  name: string;
  /** Digits only, no "+". */
  dial: string;
}

export const COUNTRIES: Country[] = RAW.split('|')
  .flatMap((chunk) => chunk.split('\n'))
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const m = /^([A-Z]{2}) (.+) (\d+)$/.exec(entry);
    return m ? { iso: m[1]!, name: m[2]!, dial: m[3]! } : null;
  })
  .filter((c): c is Country => c !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

// Time zone -> country for the common zones. The zone says where the person actually is, which the language
// setting does not (a Filipino with an English-US browser). shortcut: not every zone is listed; unknown ones
// fall back to the browser language, then to the Philippines.
const ZONES: Record<string, string> = {
  'Asia/Manila': 'PH', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID', 'Asia/Bangkok': 'TH',
  'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
  'Asia/Yangon': 'MM', 'Asia/Phnom_Penh': 'KH', 'Asia/Vientiane': 'LA', 'Asia/Brunei': 'BN', 'Asia/Jerusalem': 'IL',
  'Asia/Tehran': 'IR', 'Asia/Baghdad': 'IQ', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Macau': 'MO',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR',
  'Europe/Moscow': 'RU', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
  'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Toronto': 'CA',
  'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'America/Mexico_City': 'MX', 'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Santiago': 'CL',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Sao_Paulo': 'BR', 'America/Caracas': 'VE',
  'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'Africa/Accra': 'GH',
  'Africa/Casablanca': 'MA', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Pacific/Auckland': 'NZ',
};

const DEFAULT_ISO = 'PH';

/** The country the user is probably in: from their time zone, else their browser language, else the Philippines. */
export function guessCountry(): string {
  const known = (iso?: string) => (iso && COUNTRIES.some((c) => c.iso === iso) ? iso : undefined);
  try {
    const zone = known(ZONES[Intl.DateTimeFormat().resolvedOptions().timeZone]);
    if (zone) return zone;
    const region = known(new Intl.Locale(navigator.language).maximize().region);
    if (region) return region;
  } catch {
    /* an old browser without Intl.Locale: use the default */
  }
  return DEFAULT_ISO;
}

/** Splits "+639171234567" into its country and the rest, using the longest matching dialling code. */
export function splitPhone(value: string, preferred: string): { iso: string; national: string } | null {
  const digits = value.replace(/\D/g, '');
  if (!value.trim().startsWith('+') || !digits) return null;
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue;
    const better =
      !best ||
      c.dial.length > best.dial.length ||
      (c.dial.length === best.dial.length && c.iso === preferred);
    if (better) best = c;
  }
  return best ? { iso: best.iso, national: digits.slice(best.dial.length) } : null;
}
