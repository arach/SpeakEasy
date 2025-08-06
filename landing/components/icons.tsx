"use client"

// Static SVG icons to replace Lucide icons and prevent hydration issues

interface IconProps {
  className?: string
  size?: number
  [key: string]: any
}

export const Volume2 = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="m19.07 4.93-1.41 1.41A10 10 0 0 1 19.07 19.07l1.41 1.41A12 12 0 0 0 19.07 4.93z"></path>
    <path d="m15.54 8.46-1.41 1.41a4 4 0 0 1 0 4.24l1.41 1.41a6 6 0 0 0 0-7.07z"></path>
  </svg>
)

export const Package = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="m7.5 4.27 9 5.15"></path>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
    <path d="m3.3 7 8.7 5 8.7-5"></path>
    <path d="M12 22V12"></path>
  </svg>
)

export const Copy = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
  </svg>
)

export const Check = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="m9 12 2 2 4-4"></path>
  </svg>
)

export const Terminal = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <polyline points="4 17 10 11 4 5"></polyline>
    <line x1="12" x2="20" y1="19" y2="19"></line>
  </svg>
)

export const Settings = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
)

export const Download = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" x2="12" y1="15" y2="3"></line>
  </svg>
)

export const BookOpen = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
)

export const Play = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <polygon points="6 3 20 12 6 21 6 3"></polygon>
  </svg>
)

export const Pause = ({ className, size, ...props }: IconProps) => (
  <svg 
    className={className} 
    width={size || 24} 
    height={size || 24} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    {...props}
  >
    <rect x="14" y="4" width="4" height="16" rx="1"></rect>
    <rect x="6" y="4" width="4" height="16" rx="1"></rect>
  </svg>
)