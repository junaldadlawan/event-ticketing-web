/** How to install and use the scanner app, from getting the APK to the end of a shift. Written from the app's own screens. */
export function ScannerGuide() {
  return (
    <section className="scanner-guide" aria-labelledby="scanner-guide-title">
      <h2 id="scanner-guide-title">Scanner guide</h2>

      <h3>Before you start</h3>
      <ul>
        <li>An Android phone with a camera.</li>
        <li>An internet connection for the first sign-in. The phone can lose it later and keep scanning (see "If the connection drops").</li>
        <li>
          The account that picks the event has to be an owner, an organizer or an admin: the app authorizes the phone as a scanner for the event,
          and the API only lets those roles do that.
        </li>
      </ul>

      <h3>1. Install the app</h3>
      <ol>
        <li>On the phone, open this page and tap Download APK (or copy the file to the phone).</li>
        <li>Open the downloaded file. If Android asks, allow your browser or file manager to install apps from this source.</li>
        <li>Tap Install, then Open. The app is called Ticket scanner.</li>
        <li>Optional: compare the SHA-256 shown above with the file's, to be sure it is the one that was uploaded.</li>
      </ol>

      <h3>2. Sign in and pick the event</h3>
      <ol>
        <li>Enter the API address your organization gave you (the app checks it and shows "API connected"), then your email and password.</li>
        <li>Under "Choose an event", pick the published event this phone will check tickets for.</li>
        <li>
          Optional: type where you are scanning, such as Gate A, and tap Save gate. Every check-in from then on records that gate. You can change it
          later from Settings.
        </li>
        <li>Tap "Start scanning for this event". If the event is in pure offline mode and another phone is active, the app asks whether to replace it.</li>
        <li>Allow the camera when asked.</li>
      </ol>

      <h3>3. Scan tickets</h3>
      <ol>
        <li>Fit the ticket's QR code or barcode inside the square. The counter above shows the next scan number.</li>
        <li>The result fills the screen, with a sound:</li>
      </ol>
      <ul>
        <li><strong>Valid, let in:</strong> the ticket is good. Its details (type, gate, time) are shown.</li>
        <li><strong>Already used:</strong> it was scanned before. Do not let the person in unless you know why.</li>
        <li><strong>Invalid ticket / Wrong event:</strong> not a ticket this system issued, or one for another event.</li>
        <li><strong>Not recognized:</strong> the code isn't one of ours. It doesn't take a scan number.</li>
      </ul>
      <ol start={3}>
        <li>Tap anywhere to scan the next ticket.</li>
      </ol>

      <h3>Handy controls</h3>
      <ul>
        <li><strong>Flashlight:</strong> the torch button cycles off, on and automatic (on in the dark).</li>
        <li><strong>Lock the screen:</strong> keeps only scanning working, so nobody leaves or opens a menu by accident. Press and hold to unlock.</li>
        <li><strong>History:</strong> swipe right to see past scans, search them by ticket number, type, result or gate, and see the stats.</li>
        <li><strong>Export:</strong> in Settings, "Export scans as JSON" shares this phone's scans.</li>
      </ul>

      <h3>If the connection drops</h3>
      <ul>
        <li>The app shows "Went offline" and checks tickets against the ticket list on the phone ("Offline, against the ticket list").</li>
        <li>
          In Settings, "Download ticket list now" refreshes the list. Do it while online before the event; the app also refreshes it every 30 seconds
          when online.
        </li>
        <li>
          In standard mode the list works for about five minutes after its last refresh; after that, scanning stops until the phone reconnects.
          In pure offline mode it never expires, and a phone with no list records scans without checking them.
        </li>
        <li>When the phone is back online, it uploads the offline scans by itself. Anything the server flags, such as a ticket already used elsewhere, is shown in a list.</li>
      </ul>

      <h3>End of the shift</h3>
      <ul>
        <li>Tap Exit scanner to go back to the event list, or Sign out. The scan history stays on the phone either way.</li>
        <li>If the phone shows "This scanner was revoked by the organizer", sign in again to authorize it.</li>
      </ul>

      <h3>Troubleshooting</h3>
      <ul>
        <li><strong>Cannot reach the API:</strong> check the address and that the phone has a connection.</li>
        <li><strong>This account does not manage any events:</strong> sign in with an account that belongs to the organization.</li>
        <li><strong>Your sign-in expired:</strong> sign in again; the history is kept.</li>
        <li><strong>The code won't scan:</strong> turn the ticket's screen brightness up, use the flashlight, and hold the phone steady.</li>
      </ul>
    </section>
  );
}
