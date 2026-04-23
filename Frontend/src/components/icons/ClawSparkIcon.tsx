import { useId } from 'react'

/** Biểu tượng móng vuốt / tia AI nhỏ cạnh wordmark. */
export function ClawSparkIcon({ className }: { className?: string }) {
  const gid = useId().replace(/:/g, '')
  const gradId = `claw-spark-${gid}`

  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 2.5L11.2 6.1L14.8 7.3L11.2 8.5L10 12.1L8.8 8.5L5.2 7.3L8.8 6.1L10 2.5Z"
        fill={`url(#${gradId})`}
        opacity="0.92"
      />
      <path
        d="M14.5 11.5L15.1 13.3L16.9 13.9L15.1 14.5L14.5 16.3L13.9 14.5L12.1 13.9L13.9 13.3L14.5 11.5Z"
        fill={`url(#${gradId})`}
        opacity="0.75"
      />
      <defs>
        <linearGradient
          id={gradId}
          x1="5"
          y1="2"
          x2="17"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0066ff" />
          <stop offset="1" stopColor="#00a8ff" />
        </linearGradient>
      </defs>
    </svg>
  )
}
