# Editing the BRIGX manual

The manual is ordinary Markdown in this directory and is built with Material for MkDocs.

From the repository root:

```bash
python3 -m venv .venv-docs
.venv-docs/bin/pip install -r docs/requirements.txt
.venv-docs/bin/mkdocs serve
```

Open <http://127.0.0.1:8000>. The browser refreshes when a Markdown file or `mkdocs.yml` changes.

Before committing documentation changes, run:

```bash
.venv-docs/bin/mkdocs build --strict
```

Navigation and theme settings live in `mkdocs.yml`. Add new pages to its `nav` section so they appear in the manual.
