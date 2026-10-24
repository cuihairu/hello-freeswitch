# 导航维护说明

本站发布导航的唯一权威源是 [`sidebar.en.json`](.vitepress/sidebar.en.json)（英文，站根）与 [`sidebar.zh.json`](.vitepress/sidebar.zh.json)（简体中文，`/zh/`），由 VitePress 配置按语言各自加载。此文件仅作为 mdBook 遗留入口保留，不再维护目录副本；请勿在此添加或修改导航条目。

需要调整站点导航时，只改这两个 sidebar 文件，并在本地构建检查。`SUMMARY.md` 被 VitePress 排除，不参与页面构建，也不生成 mdBook 目录。
