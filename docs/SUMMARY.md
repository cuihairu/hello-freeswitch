# Navigation Maintenance Note

The only authoritative source for the published navigation is [`sidebar.en.json`](.vitepress/sidebar.en.json) (English, site root) and [`sidebar.zh.json`](.vitepress/sidebar.zh.json) (Simplified Chinese, `/zh/`), each loaded by the VitePress config for its own locale. This file is kept only as an mdBook legacy entry; it no longer holds a copy of the directory. Do not add or change navigation items here.

To change site navigation, edit those two sidebar files only, then check with a local build. `SUMMARY.md` is excluded from the VitePress build, so it produces no page and no mdBook directory.
