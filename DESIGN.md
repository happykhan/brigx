# BRIGX product and interface contract

BRIGX is a browser-based circular genome comparison tool. The hosted web application is the product currently supported and developed.

## Product structure

| Surface | Route | Responsibility |
|---|---|---|
| Product website | `/` | Explain BRIGX and direct people to the web application. |
| Web application | `/app` | Run the complete genome comparison workflow in a browser without uploading sequence data. |
| Desktop status | `/download` | State only that a desktop edition is coming soon. |
| About | `/about` | Record privacy, citation, licence, provenance, and third-party notices. |

## Product principles

- The web application is the primary call to action.
- Analysis remains local to the browser and sequence data is not uploaded to an analysis server.
- Scientific capability, supported formats, and privacy claims must match tested behaviour.
- The interface must remain usable on mobile, laptop, and desktop-width browser viewports.
- The public site must not imply that a desktop download, native package, or installer is available.

## Visual character

The website and workbench use the GenomicX design system, restrained teal accents, strong typographic hierarchy, and the BRIGX circular comparison figure. Decorative effects must not compete with scientific content or application state.
