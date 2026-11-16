# Swiss Army Knife — Satisfactory Companion

An unofficial **Windows desktop application** to inspect Satisfactory inventories and production, open the Satisfactory Calculator map and install community blueprints with a click.

## Zero-setup automatic mode

On launch, Swiss Army Knife scans local saves, reads the session name directly from the latest save header, displays that save's inventory snapshot, and automatically selects or creates its blueprint directory. Every 15 seconds it looks for a newer save and refreshes the snapshot. If the optional Ficsit Remote Monitoring HTTP endpoint is running, the app switches to live inventory and actual throughput rates (refreshed every 10 seconds); if it goes offline, it falls back to the last available save. It also reconnects automatically when monitoring becomes available.

**No file picker, session-name entry, or manual folder moving is needed for an ordinary local single-player game.** There are optional advanced controls to select a different save or force a different blueprint session; use **Auto-detect** to return to the latest save. The first snapshot may take longer on very large saves.

When two successive snapshots from the same session are available, the dashboard can estimate **net inventory change/minute** from the time difference between saves. That is NOT the gross production/consumption throughput provided by FRM. The precise throughput columns remain unavailable without telemetry.

### Limitations

- Live machine throughput still needs FRM (and potentially Production Stats) installed and running; a static save does not contain a live production meter. Installing or modifying Satisfactory's mod setup is not attempted silently.
- The Satisfactory Calculator map is a third-party web application. The map opens from inside Swiss Army Knife, but the app does not automatically upload private save files to that website without a separate deliberate action.
- Autosave monitoring only works while Swiss Army Knife is running. Launch the app to begin auto-discovery.
- Cloud-only saves, nonstandard folders, remote dedicated servers, and some modded save formats may need extra setup or support.

## Current features

- Live factory monitor via the [Ficsit Remote Monitoring mod](https://ficsit.app/mod/FicsitRemoteMonitoring). The app queries its local HTTP API (default port 8080).
- Searchable item list with storage, dimensional depot, total, production per minute, consumption per minute and net throughput.
- Offline .sav loading using the community Satisfactory File Parser library. The program finds local saves automatically and supports a manual file picker.
- An integrated launcher for the independent [Satisfactory Calculator interactive map](https://satisfactory-calculator.com/en/interactive-map). It opens in a sandboxed browser window and can also open in the default browser. Uploading a save to that site is manual.
- Blueprint session selection, local .sbp/.sbpcfg/.zip import, and automatic installation of supported files downloaded from the [Satisfactory Calculator blueprint library](https://satisfactory-calculator.com/en/blueprints).
- Automatic Windows portable EXE build workflow, with a downloadable GitHub Actions artifact after the build succeeds.

## Run the application

Requirements: Windows and Node.js 20 or later.

1. Clone the repository and open a terminal in it.
2. Run **npm install**.
3. Run **npm start**.
4. For live rates, install Ficsit Remote Monitoring through Satisfactory Mod Manager, start Satisfactory with your save, and enable the FRM HTTP service if needed. Connect on localhost:8080 (or its configured port).
5. Alternatively select a local .sav file from the app to view its last saved inventory quantities.
6. Open Blueprint Manager; the latest save's session is already selected automatically. Import local files or browse/download blueprints.

Run **npm test** to execute the automated tests. Run **npm run build:win** to generate an unsigned Windows portable executable in dist.

## Blueprint installation

Windows Satisfactory blueprint directory:

    %LOCALAPPDATA%\FactoryGame\Saved\SaveGames\blueprints\<SESSION NAME>

Blueprints use .sbp and optionally .sbpcfg. The app only writes those two extensions from files and archives into the selected session directory, limits file sizes, sanitizes filenames, and does not overwrite existing .sbp files. If a filename conflicts, it appends a number. After importing, **reload the Satisfactory save** so the blueprints appear in the build menu.

## Interpreting the dashboard

Live storage totals come from FRM getWorldInv, which includes storage-building inventories but not factory machinery, belts, pipes or player inventories. Cloud counts come from FRM getCloudInv. This distinction is important: **total = stored + cloud**. Current production and consumption come from FRM getProdStats when available; otherwise the app aggregates getFactory machine telemetry.

Offline save parsing reads the inventory components present in the binary save, including some inventory types not counted by getWorldInv. Its totals may therefore differ from live storage figures. **A save snapshot has no reliable live items/minute measurement**, so those fields display as unavailable. Rates are throughput and must not be interpreted as guaranteed storage growth. Some newer or modded saves may need parser changes.

The map and blueprint catalog remain services provided by Satisfactory Calculator; their remote data is not copied or scraped. This app does not automatically upload a save to Satisfactory Calculator, nor guarantee external site compatibility with Electron. Use the default browser option if needed.

## Source organization

- src/main.js — Electron main process and bounded IPC
- src/preload.js — narrow renderer bridge
- src/telemetry.js — local FRM API
- src/saves.js — read-only save discovery and parsing
- src/inventory.js — inventory and throughput normalization
- src/blueprints.js — session paths and safe installer
- src/ui — desktop interface
- test — Node test runner checks

## Roadmap

Testing with actual Satisfactory 1.2 saves and the live game is still needed. Future work could add dedicated server hosts, machine drilldowns, historical graphs, custom session directories, more detailed item icons, Linux support, native map layers where licensed, and expanded blueprint catalogs.

## Security and credits

Save parsing is read-only. Telemetry requests are restricted to 127.0.0.1; third-party webpages run in sandboxed windows without Node access. Downloaded blueprints should still be treated as untrusted data and obtained from sources you trust. Swiss Army Knife requires no account and does not upload saves itself.

This is an unofficial community project, not endorsed by Coffee Stain Studios, Satisfactory Calculator, FRM or the Satisfactory File Parser maintainers. All respective trademarks and assets belong to their owners.

MIT License.
