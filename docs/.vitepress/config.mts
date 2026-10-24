import { defineConfig } from 'vitepress'
import sidebarEn from './sidebar.en.json'
import sidebarZh from './sidebar.zh.json'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'en-US',
  title: 'Hello FreeSWITCH',
  description: 'Field notes on FreeSWITCH — installation and configuration, core concepts, dialplan, modules, scripting, and one smart customer service project',
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

  // 官方 locales：英文在根目录，中文在 /zh/，语言切换器由本块自动生成
  // 各语言的 nav / sidebar / 文案放在 locales[lang].themeConfig 内（与本块浅合并），
  // 不放在 themeConfig.locales；例外是 search 的 provider，构建期只看顶层 themeConfig.search
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Hello FreeSWITCH',
      description: 'Field notes on FreeSWITCH — installation and configuration, core concepts, dialplan, modules, scripting, and one smart customer service project',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Background', link: '/introduction/history' },
          { text: 'Install & Configure', link: '/installation/README' },
          { text: 'Core Concepts', link: '/concepts/session' }
        ],

        // sidebar.en.json / sidebar.zh.json 是唯一权威导航源；调整导航只编辑这两个文件
        sidebar: sidebarEn as never,

        outline: {
          label: 'On this page',
          level: [2, 3]
        },

        docFooter: {
          prev: 'Previous',
          next: 'Next'
        },

        lastUpdated: {
          text: 'Last updated'
        },

        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light mode',
        darkModeSwitchTitle: 'Switch to dark mode'
      }
    },

    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      title: 'Hello FreeSWITCH',
      description: 'FreeSWITCH 实践记录与开发经验分享——安装配置、核心概念、拨号计划与项目实践',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '背景记录', link: '/zh/introduction/history' },
          { text: '安装与配置', link: '/zh/installation/README' },
          { text: '核心概念记录', link: '/zh/concepts/session' }
        ],

        sidebar: sidebarZh as never,

        // 浅合并，覆盖整块以换中文按钮文案
        editLink: {
          pattern: 'https://github.com/cuihairu/hello-freeswitch/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页'
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
      }
    }
  },

  // 两站共用的外观与入口；各语言差异项在上方 locales 的 themeConfig 里覆盖
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Hello FreeSWITCH',

    // 本地搜索必须挂在顶层 themeConfig.search：构建期的 __VP_LOCAL_SEARCH__ 只看这里；
    // 各语言文案放 options.translations（根）与 options.locales.<lang>.translations
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Search the docs', buttonAriaLabel: 'Search' },
          modal: {
            resetTitle: 'Clear query',
            noResultsText: 'No results found',
            resetButtonTitle: 'Clear query',
            footer: { selectText: 'select', navigateText: 'navigate', closeText: 'close' }
          }
        },
        locales: {
          root: {
            translations: {
              button: { buttonText: 'Search the docs', buttonAriaLabel: 'Search' },
              modal: {
                resetTitle: 'Clear query',
                noResultsText: 'No results found',
                resetButtonTitle: 'Clear query',
                footer: { selectText: 'select', navigateText: 'navigate', closeText: 'close' }
              }
            }
          },
          zh: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
              modal: {
                noResultsText: '没有找到结果',
                resetButtonTitle: '清除查询条件',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
              }
            }
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cuihairu/hello-freeswitch' }
    ],

    editLink: {
      pattern: 'https://github.com/cuihairu/hello-freeswitch/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Hello FreeSWITCH',
      copyright: '© 2026 cuihairu'
    }
  },

  // SUMMARY.md 仅作遗留说明页，不维护导航；sidebar.en.json / sidebar.zh.json 是唯一权威导航源
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

  markdown: {
    lineNumbers: false
  }
})
