import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { regionAdminApi } from '../../api/endpoints';
import type { RegionCountry, RegionCurrency } from '../../api/types';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SelectField } from '../../components/fields/TextField';
import { Empty, ErrorBox, SuccessBox } from '../../components/ui';
import { COUNTRIES } from '../../utils/countries';
import { CURRENCY_OF_COUNTRY } from '../../utils/countryCurrencies';
import { formatDateTime } from '../../utils/format';
import { usePlatformRegions } from '../../utils/usePlatformRegions';

/** "1 USD = 56.4 PHP": the rate with as many digits as it needs to be useful, without trailing noise. */
const rateText = (c: RegionCurrency) => (c.usdRate == null ? null : `1 USD = ${Number(c.usdRate.toPrecision(6)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${c.code}`);

type Removing = { kind: 'currency'; item: RegionCurrency } | { kind: 'country'; item: RegionCountry } | null;

/**
 * Admin settings: which currencies and countries the platform uses. USD is the reference; every other currency's rate comes from the
 * exchange-rate feed. A country carries the currency its organizations sell in. Every country and currency list in the app follows this.
 */
export function RegionsSettings() {
  const { regions, reload } = usePlatformRegions();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // A currency is picked by the country that uses it ("Japan (JPY)"): this holds that country's code.
  const [newCurrencyFrom, setNewCurrencyFrom] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newCountryCurrency, setNewCountryCurrency] = useState('');
  const [removing, setRemoving] = useState<Removing>(null);

  const currencies = regions?.currencies ?? [];
  const countries = regions?.countries ?? [];
  const base = regions?.baseCurrency ?? 'USD';
  const taken = new Set(countries.map((c) => c.code));
  const addable = COUNTRIES.filter((c) => !taken.has(c.iso));
  const enabledCodes = new Set(currencies.map((c) => c.code));
  const addableCurrencies = COUNTRIES.filter((c) => CURRENCY_OF_COUNTRY[c.iso] && !enabledCodes.has(CURRENCY_OF_COUNTRY[c.iso]!));
  const newCurrency = CURRENCY_OF_COUNTRY[newCurrencyFrom] ?? '';
  const countryCurrency = newCountryCurrency || currencies[0]?.code || '';

  /** Runs one admin action, then reloads the lists for the whole app. */
  async function run(key: string, done: string | null, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    setMsg(null);
    try {
      await action();
      await reload();
      if (done) setMsg(done);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function addCurrency(e: FormEvent) {
    e.preventDefault();
    const code = newCurrency;
    void run('add-currency', `${code} added. Its rate comes from the exchange-rate feed.`, async () => {
      await regionAdminApi.enableCurrency(code);
      setNewCurrencyFrom('');
    });
  }

  function addCountry(e: FormEvent) {
    e.preventDefault();
    const name = COUNTRIES.find((c) => c.iso === newCountry)?.name ?? newCountry;
    void run('add-country', `${name} added.`, async () => {
      await regionAdminApi.putCountry(newCountry, countryCurrency);
      setNewCountry('');
    });
  }

  function confirmRemove() {
    const r = removing;
    setRemoving(null);
    if (!r) return;
    if (r.kind === 'currency') void run(`rm-${r.item.code}`, `${r.item.code} removed.`, () => regionAdminApi.disableCurrency(r.item.code));
    else void run(`rm-${r.item.code}`, `${r.item.name} removed.`, () => regionAdminApi.disableCountry(r.item.code));
  }

  return (
    <>
      <p className="region-intro">
        <strong>In use now.</strong> The platform only offers the countries and currencies listed here. Add one to make it appear across the platform. ({base} is the reference.)
      </p>
      <p className="region-note" role="note">
        Checkout accepts PHP only for now, so tickets priced in another currency cannot be bought yet.
      </p>
      <ErrorBox message={error} />
      <SuccessBox message={msg} />

      <section className="region-block" aria-labelledby="currencies-h">
        <div className="section-head">
          <div>
            <h2 id="currencies-h">Currencies</h2>
            <p className="muted small region-sub">What the platform can sell in. Each rate is 1 USD in that currency, from the exchange-rate feed.</p>
          </div>
          <Button size="sm" busy={busy === 'refresh'} busyLabel="Refreshing…" onClick={() => void run('refresh', 'Rates refreshed.', () => regionAdminApi.refreshRates())}>
            Refresh rates
          </Button>
        </div>
        {currencies.length === 0 ? (
          <Empty>{regions ? 'No currencies.' : 'Loading…'}</Empty>
        ) : (
          <table className="table region-table">
            <thead>
              <tr>
                <th>Currency</th>
                <th>Rate</th>
                <th>Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.code}>
                  <td>
                    <strong>{c.code}</strong> <span className="muted">{c.symbol} · {c.name}</span>
                  </td>
                  <td className="region-rate">
                    {c.code === base ? (
                      <span className="muted">Reference</span>
                    ) : (
                      rateText(c) ?? <span className="muted">Waiting for a rate</span>
                    )}
                    {c.rateStale && c.code !== base && (
                      <span className="status-chip status-warn" title="The last refresh failed or had no rate; this is the last known one.">
                        Out of date
                      </span>
                    )}
                  </td>
                  <td>{c.code === base ? '' : c.rateUpdatedAt ? formatDateTime(c.rateUpdatedAt) : '-'}</td>
                  <td className="region-actions">
                    {c.code !== base && (
                      <Button variant="link" className="danger" busy={busy === `rm-${c.code}`} onClick={() => setRemoving({ kind: 'currency', item: c })}>
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form className="form region-add" onSubmit={addCurrency}>
          <SelectField label="Country and currency" value={newCurrencyFrom} onChange={(e) => setNewCurrencyFrom(e.target.value)}>
            <option value="">Choose a country</option>
            {addableCurrencies.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name} ({CURRENCY_OF_COUNTRY[c.iso]})
              </option>
            ))}
          </SelectField>
          <Button type="submit" variant="cta" busy={busy === 'add-currency'} busyLabel="Adding…" disabled={!newCurrency}>
            Add {newCurrency || 'currency'}
          </Button>
          <p className="muted small region-add-note">Its rate against USD is fetched right away.</p>
        </form>
      </section>

      <section className="region-block" aria-labelledby="countries-h">
        <div className="section-head">
          <div>
            <h2 id="countries-h">Countries</h2>
            <p className="muted small region-sub">Where organizations and venues can be. A country sets the currency its organizations sell in.</p>
          </div>
        </div>
        {countries.length === 0 ? (
          <Empty>{regions ? 'No countries.' : 'Loading…'}</Empty>
        ) : (
          <table className="table region-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Currency</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.code}>
                  <td>
                    {c.name} <span className="muted">{c.code}</span>
                  </td>
                  <td>
                    <select
                      aria-label={`Currency of ${c.name}`}
                      value={c.currencyCode}
                      disabled={busy === `put-${c.code}`}
                      onChange={(e) => void run(`put-${c.code}`, `${c.name} now uses ${e.target.value}. Organizations already approved keep their currency.`, () => regionAdminApi.putCountry(c.code, e.target.value))}
                    >
                      {currencies.map((cur) => (
                        <option key={cur.code} value={cur.code}>
                          {cur.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="region-actions">
                    <Button variant="link" className="danger" busy={busy === `rm-${c.code}`} onClick={() => setRemoving({ kind: 'country', item: c })}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form className="form region-add" onSubmit={addCountry}>
          <SelectField label="Country" value={newCountry} onChange={(e) => setNewCountry(e.target.value)}>
            <option value="">Choose a country</option>
            {addable.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Currency" value={countryCurrency} onChange={(e) => setNewCountryCurrency(e.target.value)}>
            {currencies.map((cur) => (
              <option key={cur.code} value={cur.code}>
                {cur.code}
              </option>
            ))}
          </SelectField>
          <Button type="submit" variant="cta" busy={busy === 'add-country'} busyLabel="Adding…" disabled={!newCountry || !countryCurrency}>
            Add country
          </Button>
          <p className="muted small region-add-note">Only enabled currencies are listed. Add the currency first if it is missing.</p>
        </form>
      </section>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Remove ${removing.kind === 'currency' ? removing.item.code : removing.item.name}?` : ''}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      >
        {removing?.kind === 'currency'
          ? 'It disappears from every list. The API refuses it while a country, an organization or an event that has not ended still uses it.'
          : 'It disappears from the registration and venue lists. The API refuses it while an organization is in it, or the venue of an upcoming event is.'}
      </ConfirmDialog>
    </>
  );
}
