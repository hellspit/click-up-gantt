'use client';

export default function SkeletonLoader({ progress }: { progress: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="loading-progress">
        <span className="loading-spinner" />
        {progress || 'Loading...'}
      </div>
      <div className="skeleton-container" style={{ flex: 1, display: 'flex', gap: 1 }}>
        <div style={{ width: 400 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-bar" style={{ width: `${40 + Math.random() * 50}%`, animationDelay: `${i * 0.1}s` }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-bar" style={{
                width: `${20 + Math.random() * 40}%`,
                marginLeft: `${10 + Math.random() * 30}%`,
                animationDelay: `${i * 0.12}s`
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
