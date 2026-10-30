# Troubleshooting

## The Run Alignments button is disabled

Load a reference, create at least one ring, and add at least one file to a ring. A ring containing only a custom overlay does not provide a query sequence for BLAST.

## A ring is mostly blank

Check the global minimum identity and alignment-length filters, then the ring's lower identity threshold. Confirm that the query is related to the reference and that the file contains sequence records.

## The plot looks too crowded

- Increase ring spacing.
- Reduce individual or global ring widths.
- Hide labels on dense annotation rings.
- Hide the legend temporarily or adjust font sizes.
- Split a large comparison into more than one figure.

## A graph is flattened by one extreme value

Set **Graph Max Value** to a biologically useful cap. Values above the cap remain identifiable while the main range gains visual resolution.

## An imported feature is in the wrong place

Confirm that the feature file and loaded reference use the same assembly and coordinate system. BRIGX does not translate coordinates between reference versions.

## Alignment workers fail to start

Open the debug console and retain the complete error. Reload once to exclude a stale browser asset, then use **Report a bug** to email nabil@happykhan.com. Include the error message, steps to reproduce, browser and operating system, and whether the failure occurs with the bundled example. Do not send confidential, patient-identifiable, or raw sequence data.

## A public session URL does not load

Use a public GitHub file, GitLab.com blob/raw file, GitHub Gist, or exact Zenodo record/file URL. Gist pages and Zenodo records must contain exactly one `.brigx-session.json` or `.brigx-result.json` file; otherwise choose a direct file URL. Check that the file is valid BRIGX JSON and no larger than 25 MB. Requests time out after 20 seconds and do not follow redirects or forward private authentication. Use a commit-pinned GitLab URL for ambiguous refs, and an exact Zenodo record version rather than a redirecting concept record. Retry in the editor, choose another URL in the viewer, or download the session and load it locally.
