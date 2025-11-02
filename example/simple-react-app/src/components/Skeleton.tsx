import './Skeleton.css'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
  circle?: boolean
}

export const Skeleton = ({ className = '', width, height, rounded = false, circle = false }: SkeletonProps) => {
  const style: React.CSSProperties = {}

  if (width) {
    style.width = typeof width === 'number' ? `${width}px` : width
  }
  if (height) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }

  const roundedClass = circle ? 'skeleton-circle' : rounded ? 'skeleton-rounded' : ''

  return <div className={`skeleton ${roundedClass} ${className}`.trim()} style={style} />
}
