# Swiss Army Knife — Satisfactory Companion

**Swiss Army Knife 0.2.1** is an unofficial Windows companion for live Satisfactory inventories, Satisfactory Calculator map/planners, and automatic community blueprint installation.

## Live-first dashboard

The first page connects automatically to Ficsit Remote Monitoring (FRM) on the local machine, using port 8080 by default. If the game or FRM is not yet running, it retries every 10 seconds. No save selection or uploading is required or displayed on the first page. On disconnect, the UI clearly labels the last inventory values as stale while continuing to reconnect.

Live totals and throughput require the FRM mod to be installed and enabled via Satisfactory Mod Manager. The app cannot create this game telemetry on its own.

### Fixing "Reconnecting automatically" / localhost:8080

The FRM HTTP server may be stopped even when the mod is installed. In a loaded Satisfactory world:

1. Install and enable [Ficsit Remote Monitoring](https://ficsit.app/mod/FicsitRemoteMonitoring) with Satisfactory Mod Manager if you have not already.
2. Open in-game chat and enter `/frm http start`. This starts the mod's HTTP API.
3. To make the change persistent, enable the FRM web-server **Autostart** option from the game's mod settings.
4. Press **Check connection again** in Swiss Army Knife, or let it retry automatically.

Swiss Army Knife now reads the local game's FRM configuration when available, tries its configured port alongside common local ports, and distinguishes a stopped service from unexpected API data or a wrong port. It shows recovery steps directly on the dashboard rather than a repeating error toast. This is still a real mod requirement: the app cannot start an HTTP server that is not running inside the game.

Change the port in **Settings** to override auto-detection or return to **Auto-detect port** if the chosen port is wrong.

### Ad and tracker protection

The Settings tab contains ad/tracker filtering for Satisfactory Calculator's embedded map, planners, and blueprint browser. It is on by default and uses [Ghostery's Electron ad-blocking engine](https://github.com/ghostery/adblocker), with **uBlock/EasyList-compatible filtering** and a cached ruleset. You can disable it from Settings if it interferes with a website. If rules cannot be loaded and no cache is present, the app continues normally but tells you protection is inactive.

**The actual uBlock Origin Lite extension is not installed inside the app:** Electron does not support the Chrome `declarativeNetRequest` API that the extension requires. The integrated filtering provides similar network and cosmetic filtering for these embedded pages without misrepresenting itself as uBlock Origin Lite.

Inventory rows have game-generated icons extracted locally from FRM's Icons endpoint, with a fallback initial for missing icons. Columns include name, storage, Dimensional Depot, total, production/min, consumption/min and net/min. Click any column header to sort ascending/descending, and use the search box to filter items.

Satisfactory save headers are still scanned in the background solely to determine the blueprint session folder; factory counts on the dashboard come from live telemetry, not static save snapshots.

## Embedded Satisfactory Calculator tools

- **Map:** https://satisfactory-calculator.com/en/interactive-map
- **Production planner:** https://satisfactory-calculator.com/en/planners/production
- **Power planner:** https://satisfactory-calculator.com/en/planners/power

All three load inside separate sandboxed views in the application. They preserve their website session state when switching tabs, require an internet connection and are not cloned or scraped. If the site blocks embedding, use Open in browser from the relevant tab. Save uploads to Satisfactory Calculator remain a deliberate user action.

## Blueprint catalog and automatic installation

Blueprint Manager embeds the original Satisfactory Calculator community catalog at https://satisfactory-calculator.com/en/blueprints. Search and browse its listings, open a blueprint detail page and click Install this blueprint to download both SBP and configuration files into the automatically detected game session. Manual SBP, SBPCFG and ZIP import is also supported.

Windows blueprint directory:

    %LOCALAPPDATA%\FactoryGame\Saved\SaveGames\blueprints\<SESSION NAME>

Existing SBP files are never overwritten; conflicting filenames receive numbered suffixes. Reload the game save after installing blueprints. Satisfactory Calculator's download formats may change, so manual import remains as a fallback.

## Run and build

Requires Windows and Node.js 20+ to run from source.

1. Clone the repository.
2. Run npm install.
3. Run npm start.
4. Launch Satisfactory with Ficsit Remote Monitoring enabled to see live data. The app connects automatically.

On PowerShell systems that block `npm.ps1`, use `npm.cmd install` and `npm.cmd start` instead. Run `npm.cmd test` for automated checks, or `npm.cmd run build:win` for an unsigned portable Windows EXE. GitHub Actions produces a Windows executable artifact after successful tests and packaging.

## Accuracy and limitations

FRM getWorldInv includes storage buildings but excludes belts, pipes, player pockets and factory machine input inventories. Dimensional Depot items are reported separately by getCloudInv. Current production/consumption come from getProdStats when available or getFactory when supported; unavailable fields show a dash. Net production is not necessarily identical to changes in physical storage.

The application contacts local telemetry at 127.0.0.1 and does not upload local saves to Satisfactory Calculator. Each embedded site remains a third-party website with its own privacy practices, isolated from Node.js. This is an initial build that still needs end-to-end testing with real Satisfactory sessions and the live website.

Satisfactory belongs to Coffee Stain Studios; Satisfactory Calculator and FRM are independent community projects. No endorsement or affiliation is claimed. MIT License; dependencies retain their own licenses.
