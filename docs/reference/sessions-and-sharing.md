# Sessions and sharing

BRIGX distinguishes editable sessions from read-only result views.

## Save and load an editable session

Select **Save session** to download a JSON session file. Select **Load session** to restore it. Modern sessions can include the computed result, allowing the plot to reopen without immediately rerunning the alignment.

Keep the original genome files as part of the analysis record even when a result is embedded in the session.

## Local preview

After a result exists, **Preview result** opens a clean, read-only viewer. The generated link is stored in the current browser for 24 hours. It is useful for checking presentation but is not shareable with another person or browser.

## Public GitHub session

The preview page can load a public BRIGX result or session from a GitHub file URL. A viewer can inspect the result without editing it, then choose **Edit session** when the source contains an editable session.

Only publish session files whose sequence and metadata are safe to make public.

## URL loading

An editable workspace can load a public session through the `url` query parameter:

```text
/app?url=https://github.com/OWNER/REPOSITORY/blob/BRANCH/session.json
```

The read-only preview page accepts the same public GitHub file URL through its form.
