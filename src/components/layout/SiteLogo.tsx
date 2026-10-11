import React from 'react'

interface SiteLogoProps {
  /** 渲染尺寸(px),默认 32,对应页头原 8×8 方块 */
  size?: number
  className?: string
}

/**
 * 站点 LOGO:「终端光标 Q」
 *
 * 橙色品牌渐变(#E88B45 → #D36F2B → #B8591F)圆角方块上的白色 Q,
 * 尾笔沿 45° 穿出圆环,形似命令行光标。纯 SVG 且配色固定,
 * 明暗主题下都成立;同款图形见 src/app/icon.svg(favicon)。
 */
export const SiteLogo: React.FC<SiteLogoProps> = ({ size = 32, className }) => {
  // useId 保证同页多实例时渐变 id 不冲突(默认值含冒号,需过滤)
  const gradientId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Qzhou Blog"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E88B45" />
          <stop offset="0.5" stopColor="#D36F2B" />
          <stop offset="1" stopColor="#B8591F" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${gradientId})`} />
      <circle cx="29" cy="29" r="13.5" fill="none" stroke="#FFFFFF" strokeWidth="7" />
      <line
        x1="38.5"
        y1="38.5"
        x2="47"
        y2="47"
        stroke="#FFFFFF"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  )
}
