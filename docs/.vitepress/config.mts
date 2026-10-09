import { defineConfig } from 'vitepress'
import sidebar from './sidebar.json'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: 'Hello FreeSWITCH',
  description: 'FreeSWITCH 知识手册——安装配置、核心概念、拨号计划与智能客服实战',
  base: '/hello-freeswitch/',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: 'https://cuihairu.github.io',
    // alpha 版把不带 base 的绝对路径交给 sitemap 库解析，会吞掉 base；此钩子把前缀补回
    transformItems(items) {
      return items.map((item) => ({
        ...item,
        url: '/hello-freeswitch' + (item.url.startsWith('/') ? item.url : `/${item.url}`)
      }))
    }
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/hello-freeswitch/favicon.svg' }]
  ],

  // mdbook 遗留的目录文件保留在仓库作映射底稿，不作为页面构建
  srcExclude: ['**/SUMMARY.md'],

  // 每页补 og 分享 meta（返回值与原 head 合并，不会覆盖默认项）
  // ctx.page 是 md 源路径而非输出 html（类型注释与实测不符），按 md 去后缀
  transformHead({ page, title, description }) {
    const route = '/' + page.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')
    const url = encodeURI('https://cuihairu.github.io/hello-freeswitch' + (route === '/' ? '/' : route))
    return [
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'Hello FreeSWITCH' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { name: 'twitter:card', content: 'summary' }]
    ]
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Hello FreeSWITCH',

    nav: [
      { text: '首页', link: '/' },
      { text: '引言', link: '/introduction/history' },
      { text: '安装与配置', link: '/installation/README' },
      { text: '核心概念', link: '/concepts/session' }
    ],

    // 由 mdbook SUMMARY.md 结构映射而来（vitepress-migration/parse_summary.py），
    // 现有 7 个分组：引言 / 安装与配置 / 核心概念 / 模块详解 / 进阶应用 / 实战项目 / 附录
    sidebar: sidebar as never,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cuihairu/hello-freeswitch' }
    ],

    editLink: {
      pattern: 'https://github.com/cuihairu/hello-freeswitch/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    footer: {
      message: 'Hello FreeSWITCH',
      copyright: '© 2026 cuihairu'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    outline: {
      label: '页面导航',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    lastUpdated: {
      text: '最后更新'
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
  },

  markdown: {
    lineNumbers: false
  }
})
