/**
 * 站点对外展示的社交与联系方式。
 *
 * 全部来自 NEXT_PUBLIC_* 环境变量，未配置的条目直接不产生 —— 线上站点上
 * 绝不能渲染 github.com/username、hello@example.com 这类占位地址。
 *
 * 两个必须遵守的约束：
 *  1. 用 NEXT_PUBLIC_ 前缀而非运行时变量：Footer 会被客户端组件（error.tsx）
 *     引用，只有构建期内联的 NEXT_PUBLIC_* 在服务端与客户端两侧取值一致，
 *     否则同一页面会出现链接有无不一致的水合结果。
 *  2. 必须写成 process.env.NEXT_PUBLIC_XXX 这种字面量形式。Next 的替换是
 *     静态文本匹配，写成 process.env[name] 会在打包时匹配不上，浏览器侧
 *     拿到 undefined、服务端构建后也查不到值，表现为"配了也永远不显示"。
 *
 * 因为是构建期内联，改这三个值要重新构建镜像，光改 .env 重启容器无效。
 */
export type PublicLinkKind = 'github' | 'twitter' | 'email'

export interface PublicLink {
  href: string
  label: string
  kind: PublicLinkKind
}

function normalize(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getPublicLinks(): PublicLink[] {
  const github = normalize(process.env.NEXT_PUBLIC_GITHUB_URL)
  const twitter = normalize(process.env.NEXT_PUBLIC_TWITTER_URL)
  const email = normalize(process.env.NEXT_PUBLIC_CONTACT_EMAIL)

  const links: PublicLink[] = []
  if (github) links.push({ href: github, label: 'GitHub', kind: 'github' })
  if (twitter) links.push({ href: twitter, label: 'Twitter', kind: 'twitter' })
  if (email) links.push({ href: 'mailto:' + email, label: '邮箱', kind: 'email' })
  return links
}
