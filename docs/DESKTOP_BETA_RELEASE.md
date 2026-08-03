# BRIGX Desktop — Beta / unsigned community build

This prerelease provides the complete BRIGX desktop scientific workflow for Windows and Linux. It uses the same first-party circular renderer and integrity-checked BLAST WebAssembly pipeline as the hosted web application. Analysis data remains on the computer.

## Important signing notice

The Windows package is intentionally distributed as an unsigned community beta build while the project has no Windows publisher certificate.

- **Windows:** Microsoft Defender SmartScreen may display an unknown-publisher warning. Choose **More info**, verify that the application is BRIGX, then choose **Run anyway**.
- **Linux:** install the DEB or RPM package normally, or make the AppImage executable. System WebKitGTK dependencies are required.

macOS packages are intentionally withheld from public beta releases until Developer ID signing and Apple notarisation are configured. Browser-downloaded unsigned applications can be rejected by Gatekeeper as damaged, which is not an acceptable installation experience.

People who do not want to install an unsigned Windows application should use the hosted edition at https://brigx.genomicx.org/app.

## Packages

- Windows x64 NSIS installer
- Linux x64 AppImage, DEB, and RPM
- `SHA256SUMS.txt` covering every installer

GitHub build-provenance attestations are attached to the packages by the release workflow. Verify a local download with `sha256sum -c SHA256SUMS.txt` on Linux or `Get-FileHash -Algorithm SHA256` on Windows.

## Beta limitations

- Updates are manual; there is no automatic updater.
- Desktop-specific interface details may change before a stable signed release.
- A `.brigx` project records local file paths and hashes but does not copy genome contents. Keep the referenced input files available and treat project filenames and paths as potentially sensitive.
- There are no accounts, cloud storage, subscriptions, advertising, analytics, or telemetry.

Please report reproducible problems at https://github.com/happykhan/brigx/issues. Never attach confidential, patient-identifiable, or otherwise sensitive genome data.
