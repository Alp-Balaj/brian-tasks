import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

/** 24px stroke icons, drawn inline so the PWA has no icon font to fetch. */
function Svg({ d, size = 20, ...rest }: IconProps & { d: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={d} />
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => <Svg d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...p} />
export const BoardIcon = (p: IconProps) => <Svg d="M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z" {...p} />
export const ListIcon = (p: IconProps) => <Svg d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />
export const CalendarIcon = (p: IconProps) => <Svg d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4" {...p} />
/** A week: three day rows in a frame, each with a block at a different hour. */
export const WeekIcon = (p: IconProps) => <Svg d="M3 4h18v16H3zM6 9h6M10 12.5h8M6 16h9" {...p} />
export const ArchiveIcon = (p: IconProps) => <Svg d="M3 4h18v4H3zM4 8v12h16V8M10 12h4" {...p} />
export const PlusIcon = (p: IconProps) => <Svg d="M12 5v14M5 12h14" {...p} />
export const CheckIcon = (p: IconProps) => <Svg d="M5 12.5 10 17l9-10" {...p} />
export const CloseIcon = (p: IconProps) => <Svg d="M6 6l12 12M18 6 6 18" {...p} />
export const ChevronDownIcon = (p: IconProps) => <Svg d="m6 9 6 6 6-6" {...p} />
export const ChevronLeftIcon = (p: IconProps) => <Svg d="m15 6-6 6 6 6" {...p} />
export const ChevronRightIcon = (p: IconProps) => <Svg d="m9 6 6 6-6 6" {...p} />
