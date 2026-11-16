# Swiss Army Knife — Satisfactory Companion

**Swiss Army Knife 0.2** is an unofficial Windows companion for live Satisfactory inventories, Satisfactory Calculator map/planners, and automatic community blueprint installation.

## Live-first dashboard

The first page connects automatically to Ficsit Remote Monitoring (FRM) on the local machine, using port 8080 by default. If the game or FRM is not yet running, it retries every 10 seconds. No save selection or uploading is required or displayed on the first page. On disconnect, the UI clearly labels the last inventory values as stale while continuing to reconnect.

Live totals and throughput require the FRM mod to be installed and enabled via Satisfactory Mod Manager. The application does not silently install or configure mods. The port can be changed under Settings if FRM uses a different port.

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

Run npm test for automated checks, or npm run build:win for an unsigned portable Windows EXE. GitHub Actions produces a Windows executable artifact after successful tests and packaging.

## Accuracy and limitations

FRM getWorldInv includes storage buildings but excludes belts, pipes, player pockets and factory machine input inventories. Dimensional Depot items are reported separately by getCloudInv. Current production/consumption come from getProdStats when available or getFactory when supported; unavailable fields show a dash. Net production is not necessarily identical to changes in physical storage.

The application contacts local telemetry at 127.0.0.1 and does not upload local saves to Satisfactory Calculator. Each embedded site remains a third-party website with its own privacy practices, isolated from Node.js. This is an initial build that still needs end-to-end testing with real Satisfactory sessions and the live website.

Satisfactory belongs to Coffee Stain Studios; Satisfactory Calculator and FRM are independent community projects. No endorsement or affiliation is claimed. MIT License; dependencies retain their own licenses.
