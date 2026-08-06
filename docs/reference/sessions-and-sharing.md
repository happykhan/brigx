# Sessions and sharing

BRIGX distinguishes editable sessions from read-only result views.

## Save and load an editable session

Select **Save session** to download a JSON session file. Select **Load session** to restore it. Modern sessions can include the computed result, allowing the plot to reopen without immediately rerunning the alignment.

Keep the original genome files as part of the analysis record even when a result is embedded in the session.

## Public GitHub session

The **Viewer** can load a public BRIGX result or session from a GitHub file URL. It shows the interactive plot, reference and query statistics, per-ring coverage and average identity. Where the saved result contains the original tabular BLAST output, each query ring also provides a **Download** action. A viewer can inspect and download these results without editing them, then choose **Edit session** when the source contains an editable session.

Only publish session files whose sequence and metadata are safe to make public.

## URL loading

An editable workspace can load a public session through the `url` query parameter:

```text
/app?url=https://github.com/OWNER/REPOSITORY/blob/BRANCH/session.json
```

The read-only viewer accepts the same public GitHub file URL through its form or through the `url` query parameter:

```text
/viewer?url=https://github.com/OWNER/REPOSITORY/blob/BRANCH/session.json
```
