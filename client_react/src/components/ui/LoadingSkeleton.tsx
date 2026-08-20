interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export default function LoadingSkeleton({ 
  width = '100%', 
  height = 16, 
  borderRadius = '0.5rem',
  className = ''
}: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%] ${className}`}
      style={{ 
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius
      }}
    />
  );
}