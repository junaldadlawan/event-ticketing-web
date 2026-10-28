// The official currency (ISO 4217) of each country in the countries list (ISO 3166-1 alpha-2). Reference data, so the admin can pick a
// currency by the country that uses it instead of typing a code. Format: "country currency". Countries that share a currency (the
// euro, the CFA francs) are listed with it each time.
const RAW = `
AF AFN|AL ALL|DZ DZD|AD EUR|AO AOA|AR ARS|AM AMD|AU AUD|AT EUR|AZ AZN|BS BSD|BH BHD|BD BDT|BB BBD|BY BYN|BE EUR|BZ BZD
BJ XOF|BT BTN|BO BOB|BA BAM|BW BWP|BR BRL|BN BND|BG BGN|BF XOF|BI BIF|KH KHR|CM XAF|CA CAD|CV CVE|CF XAF|TD XAF|CL CLP
CN CNY|CO COP|KM KMF|CG XAF|CD CDF|CR CRC|CI XOF|HR EUR|CU CUP|CY EUR|CZ CZK|DK DKK|DJ DJF|DO DOP|EC USD|EG EGP|SV USD
GQ XAF|ER ERN|EE EUR|SZ SZL|ET ETB|FJ FJD|FI EUR|FR EUR|GA XAF|GM GMD|GE GEL|DE EUR|GH GHS|GR EUR|GT GTQ|GN GNF|GY GYD
HT HTG|HN HNL|HK HKD|HU HUF|IS ISK|IN INR|ID IDR|IR IRR|IQ IQD|IE EUR|IL ILS|IT EUR|JM JMD|JP JPY|JO JOD|KZ KZT|KE KES
KW KWD|KG KGS|LA LAK|LV EUR|LB LBP|LS LSL|LR LRD|LY LYD|LI CHF|LT EUR|LU EUR|MO MOP|MG MGA|MW MWK|MY MYR|MV MVR|ML XOF
MT EUR|MR MRU|MU MUR|MX MXN|MD MDL|MC EUR|MN MNT|ME EUR|MA MAD|MZ MZN|MM MMK|NA NAD|NP NPR|NL EUR|NZ NZD|NI NIO|NE XOF
NG NGN|KP KPW|MK MKD|NO NOK|OM OMR|PK PKR|PS ILS|PA PAB|PG PGK|PY PYG|PE PEN|PH PHP|PL PLN|PT EUR|PR USD|QA QAR|RO RON
RU RUB|RW RWF|SA SAR|SN XOF|RS RSD|SC SCR|SL SLE|SG SGD|SK EUR|SI EUR|SB SBD|SO SOS|ZA ZAR|KR KRW|SS SSP|ES EUR|LK LKR
SD SDG|SR SRD|SE SEK|CH CHF|SY SYP|TW TWD|TJ TJS|TZ TZS|TH THB|TL USD|TG XOF|TT TTD|TN TND|TR TRY|TM TMT|UG UGX|UA UAH
AE AED|GB GBP|US USD|UY UYU|UZ UZS|VU VUV|VE VES|VN VND|YE YER|ZM ZMW|ZW ZWL
`;

/** Country code -> the currency code its people use ("PH" -> "PHP"). */
export const CURRENCY_OF_COUNTRY: Record<string, string> = Object.fromEntries(
  RAW.split('|')
    .flatMap((chunk) => chunk.split('\n'))
    .map((entry) => entry.trim().split(' '))
    .filter((pair): pair is [string, string] => pair.length === 2 && pair[0]!.length === 2 && pair[1]!.length === 3),
);
