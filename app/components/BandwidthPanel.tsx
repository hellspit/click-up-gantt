'use client';

import { useEffect, useMemo } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { computeBandwidthSummary } from '../utils/bandwidthUtils';

interface Props {
  onClose: () => void;
}

export default function BandwidthPanel({ onClose }: Props) {
  const allIndividualTasks = useTaskStore(s => s.allIndividualTasks);
  const allIndividualNoDateTasks = useTaskStore(s => s.allIndividualNoDateTasks);
  const selectedUserName = useTaskStore(s => s.selectedUserName);

  const bandwidth = useMemo(
    () => computeBandwidthSummary(allIndividualTasks, allIndividualNoDateTasks),
    [allIndividualTasks, allIndividualNoDateTasks]
  );

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />

      <div className="detail-panel bw-panel">
        {/* Header */}
        <div className="detail-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(88, 166, 255, 0.15), rgba(188, 140, 255, 0.15))',
              border: '1px solid rgba(88, 166, 255, 0.2)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}>BW</span>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}>Bandwidth Overview</div>
              {selectedUserName && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  marginTop: '2px',
                }}>{selectedUserName}</div>
              )}
            </div>
          </div>
          <button className="detail-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Availability Status */}
        <div className="bw-panel-section">
          <div className="bw-panel-section-title">Availability</div>
          <div className="bw-panel-card">
            <div className="bw-panel-stat-row">
              <div className="bw-panel-stat-label">
                <span className="bw-panel-stat-dot" style={{
                  background: !bandwidth.hasWorkInNext14Days ? '#3fb950' : '#f0883e',
                }} />
                Has Bandwidth (Next 14 Days)
              </div>
              <div className={`bw-panel-stat-value ${!bandwidth.hasWorkInNext14Days ? 'bw-panel-val-yes' : 'bw-panel-val-no'}`}>
                {!bandwidth.hasWorkInNext14Days ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="bw-panel-divider" />

            <div className="bw-panel-stat-row">
              <div className="bw-panel-stat-label">
                <span className="bw-panel-stat-dot" style={{
                  background: bandwidth.isFreeNow ? '#3fb950' : '#58a6ff',
                }} />
                Currently Free
              </div>
              <div className={`bw-panel-stat-value ${bandwidth.isFreeNow ? 'bw-panel-val-yes' : ''}`}>
                {bandwidth.isFreeNow ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="bw-panel-divider" />

            <div className="bw-panel-stat-row">
              <div className="bw-panel-stat-label">
                <span className="bw-panel-stat-dot" style={{
                  background: '#bc8cff',
                }} />
                Free From
              </div>
              <div className={`bw-panel-stat-value ${bandwidth.isFreeNow ? 'bw-panel-val-yes' : ''}`}>
                {bandwidth.freeFromLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Free Days */}
        <div className="bw-panel-section">
          <div className="bw-panel-section-title">Free Days</div>
          <div className="bw-panel-card">
            <div className="bw-panel-stat-row">
              <div className="bw-panel-stat-label">
                <span className="bw-panel-stat-dot" style={{ background: '#bc8cff' }} />
                Total Free Days (Next 14 Days)
              </div>
              <div className={`bw-panel-stat-value ${bandwidth.freeDaysCount > 0 ? 'bw-panel-val-free' : 'bw-panel-val-muted'}`}>
                {bandwidth.freeDaysCount > 0 ? `${bandwidth.freeDaysCount} days` : 'None'}
              </div>
            </div>
          </div>
        </div>

        {/* Free Date Ranges */}
        {bandwidth.freeGaps.length > 0 && (
          <div className="bw-panel-section">
            <div className="bw-panel-section-title">Free Date Ranges</div>
            <div className="bw-panel-card">
              {bandwidth.freeGaps.map((gap, idx) => (
                <div key={idx}>
                  {idx > 0 && <div className="bw-panel-divider" />}
                  <div className="bw-panel-gap-row">
                    <div className="bw-panel-gap-dates">
                      <span className="bw-panel-gap-dot" />
                      {gap.label}
                    </div>
                    <div className="bw-panel-gap-days">{gap.days}d</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="bw-panel-section">
          <div className="bw-panel-section-title">Task Summary</div>
          <div className="bw-panel-stats-grid">
            <div className="bw-panel-mini-card">
              <div className="bw-panel-mini-value">{allIndividualTasks.length}</div>
              <div className="bw-panel-mini-label">Dated Tasks</div>
            </div>
            <div className="bw-panel-mini-card">
              <div className="bw-panel-mini-value">{allIndividualNoDateTasks.length}</div>
              <div className="bw-panel-mini-label">No-Date Tasks</div>
            </div>
            <div className="bw-panel-mini-card">
              <div className="bw-panel-mini-value">{allIndividualTasks.length + allIndividualNoDateTasks.length}</div>
              <div className="bw-panel-mini-label">Total Tasks</div>
            </div>
            <div className="bw-panel-mini-card">
              <div className="bw-panel-mini-value" style={{ color: bandwidth.freeDaysCount > 0 ? '#3fb950' : '#f0883e' }}>
                {bandwidth.freeDaysCount}
              </div>
              <div className="bw-panel-mini-label">Free Days</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
