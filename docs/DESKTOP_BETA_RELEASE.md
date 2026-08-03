# BRIGX Desktop — Beta / unsigned community build

This prerelease provides the complete BRIGX desktop scientific workflow for macOS, Windows, and Linux. It uses the same first-party circular renderer and integrity-checked BLAST WebAssembly pipeline as the hosted web application. Analysis data remains on the computer.

## Important signing notice

These packages are intentionally distributed as unsigned community beta builds while the project has no paid Apple Developer ID or Windows Authenticode certificate.

- **macOS:** Gatekeeper will block the first launch. Open BRIGX once, then use **System Settings → Privacy & Security → Open Anyway** and confirm **Open**.
- **Windows:** Microsoft Defender SmartScreen may display an unknown-publisher warning. Choose **More info**, verify that the application is BRIGX, then choose **Run anyway**.
- **Linux:** install the DEB or RPM package normally, or make the AppImage executable. System WebKitGTK dependencies are required.

People who do not want to install an unsigned application should use the hosted edition at https://brigx.genomicx.org/app.

## Packages

- macOS DMG for Apple silicon
- macOS DMG for Intel
- Windows x64 NSIS installer
- Linux x64 AppImage, DEB, and RPM
- `SHA256SUMS.txt` covering every installer

GitHub build-provenance attestations are attached to the packages by the release workflow. Verify a local download with `sha256sum -c SHA256SUMS.txt` on Linux, `shasum -a 256 -c SHA256SUMS.txt` on macOS, or `Get-FileHash -Algorithm SHA256` on Windows.

## Beta limitations

- Updates are manual; there is no automatic updater.
- Desktop-specific interface details may change before a stable signed release.
- A `.brigx` project records local file paths and hashes but does not copy genome contents. Keep the referenced input files available and treat project filenames and paths as potentially sensitive.
- There are no accounts, cloud storage, subscriptions, advertising, analytics, or telemetry.

Please report reproducible problems at https://github.com/happykhan/brigx/issues. Never attach confidential, patient-identifiable, or otherwise sensitive genome data.
