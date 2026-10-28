# Sessions and sharing

BRIGX distinguishes editable sessions from read-only result views.

## Save and load an editable session

Select **Save session** to download a JSON session file. Select **Load session** to restore it. Modern sessions can include the computed result, allowing the plot to reopen without immediately rerunning the alignment.

Keep the original genome files as part of the analysis record even when a result is embedded in the session.

## Public BRIGX session URLs

The **Viewer** can load a public BRIGX result or session from a supported public URL. It shows the interactive plot, reference and query statistics, per-ring coverage and average identity. Where the saved result contains the original tabular BLAST output, each query ring also provides a **Download** action. A viewer can inspect and download these results without editing them, then choose **Edit session** when the source contains an editable session.

Only publish session files whose sequence and metadata are safe to make public.

## URL loading

An editable workspace can load a public session through the `url` query parameter:

```text
/app?url=https://github.com/OWNER/REPOSITORY/blob/BRANCH/session.json
```

The read-only viewer accepts the same public session URL through its form or through the `url` query parameter:

```text
/viewer?url=https://github.com/OWNER/REPOSITORY/blob/BRANCH/session.json
```

The URL input is labelled **Public BRIGX session URL**. Supported providers are:

| Provider | Accepted links |
| --- | --- |
| GitHub | Repository `/blob/` links and `raw.githubusercontent.com` file links |
| GitLab.com | Repository `/-/blob/` and `/-/raw/` links, including nested namespaces and refs containing slashes |
| GitHub Gists | Gist pages (optionally pinned to a revision) and `gist.githubusercontent.com` raw-file links |
| Zenodo | Exact `/records/<id>` record links and `/records/<id>/files/<filename>` links (optionally `?download=1`) |

`/preview?url=…` remains an alias of `/viewer?url=…`; `/app?url=…` opens an editable session. The original source URL stays in the address bar and is passed unchanged to **Edit session**. Result-only files can be viewed but are not editable sessions.

A Gist page or Zenodo record must contain exactly one file ending in `.brigx-session.json` or `.brigx-result.json`. If there are no matching files, use a direct file link. If there are multiple matching files, choose the desired raw-file link explicitly. Downloaded JSON still passes BRIGX's session/result validation. Gist file content is downloaded from its approved raw URL even when the metadata contains only truncated content. Incomplete Gist file lists are rejected.

GitLab's web raw endpoint does not allow browser cross-origin reads. BRIGX resolves the complete ref/path using public branch/tag metadata, then downloads from GitLab's public files API at the resolved commit. A branch/tag name collision with different commits requires a commit-pinned file URL. No self-hosted GitLab domains are supported.

Zenodo resolves both record and direct file links through its public API and downloads the API-provided file link. Direct file links select that filename explicitly even when the record has several BRIGX files. It loads the requested record version. It does not follow a record's “latest version” link. Use an exact version record rather than a concept record that redirects.

All requests use HTTPS, omit credentials, disable caching and reject redirects before they are followed. Only the listed providers' exact API/raw origins are allowed. URLs containing credentials, authentication tokens, custom ports or unsupported query parameters are rejected. Private resources, OAuth and arbitrary URL downloads are not supported. One 20-second deadline covers resolution and download; each response is limited to 25 MB, checked from both declared length and streamed bytes.

Opening a saved session restores its plot and editing controls, not its source FASTA files. Re-add the reference and query files before rerunning BLAST. A failed URL can be retried or replaced, and local session loading remains available.
