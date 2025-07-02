import React, { useState, useEffect } from 'react';
import { useNetworkStatusContext } from '@/contexts/NetworkStatusContext';
import { IconWifi, IconWifiOff, IconAlertTriangle, IconInfoCircle, IconX, IconRefresh } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface NetworkStatusIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetails?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  position = 'bottom-right',
  showDetails = true,
  autoHide = true,
  autoHideDelay = 5000,
}) => {
  const networkStatus = useNetworkStatusContext();
  const [isVisible, setIsVisible] = useState(!networkStatus.isOnline);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  const qualityColors = {
    poor: 'text-red-500 bg-red-50 border-red-200',
    fair: 'text-orange-500 bg-orange-50 border-orange-200',
    good: 'text-blue-500 bg-blue-50 border-blue-200',
    excellent: 'text-green-500 bg-green-50 border-green-200',
  };

  const qualityIcons = {
    poor: <IconAlertTriangle className="w-4 h-4" />,
    fair: <IconWifi className="w-4 h-4" />,
    good: <IconWifi className="w-4 h-4" />,
    excellent: <IconWifi className="w-4 h-4" />,
  };

  useEffect(() => {
    if (!networkStatus.isOnline || networkStatus.quality.quality === 'poor') {
      setIsVisible(true);
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        setAutoHideTimer(null);
      }
    } else if (autoHide && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
      setAutoHideTimer(timer);
    }

    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [networkStatus.isOnline, networkStatus.quality.quality, autoHide, autoHideDelay, isVisible]);

  if (!isVisible) return null;

  return (
    <div className={cn('fixed z-50 flex flex-col gap-2', positionClasses[position])}>
      {/* Main Status Indicator */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border transition-all cursor-pointer',
          !networkStatus.isOnline
            ? 'bg-red-50 border-red-200 text-red-7ResourceHistoryTable'
            : qualityColors[networkStatus.quality.quality]
        )}
        onClick={() => showDetails && setShowDetailPanel(!showDetailPanel)}
      >
        {!networkStatus.isOnline ? (
          <>
            <IconWifiOff className="w-5 h-5" />
            <span className="font-medium">Offline</span>
          </>
        ) : (
          <>
            {qualityIcons[networkStatus.quality.quality]}
            <span className="font-medium">
              {networkStatus.quality.quality.charAt(0).toUpperCase() + 
               networkStatus.quality.quality.slice(1)} Connection
            </span>
          </>
        )}

        {showDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetailPanel(!showDetailPanel);
            }}
            className="ml-2 p-1 hover:bg-black/10 rounded"
          >
            <IconInfoCircle className="w-4 h-4" />
          </button>
        )}

        {networkStatus.retryQueue.length > 0 && (
          <div className="flex items-center gap-1">
            <IconRefresh className="w-4 h-4 animate-spin" />
            <span className="text-sm">{networkStatus.retryQueue.length}</span>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {showDetailPanel && (
        <div className="bg-white rounded-lg shadow-xl border p-4 min-w-[300px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Network Details</h3>
            <button
              onClick={() => setShowDetailPanel(false)}
              className="p-1 hover:bg-gray-10 rounded"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-6ResourceHistoryTable">Status:</span>
              <span className="font-medium">
                {networkStatus.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-6ResourceHistoryTable">Connection Type:</span>
              <span className="font-medium">
                {networkStatus.connectionType || 'Unknown'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-6ResourceHistoryTable">Effective Type:</span>
              <span className="font-medium">
                {networkStatus.effectiveType.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-6ResourceHistoryTable">Latency:</span>
              <span className="font-medium">
                {networkStatus.quality.latency}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-6ResourceHistoryTable">Bandwidth:</span>
              <span className="font-medium">
                {networkStatus.quality.bandwidth} Mbps
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-6ResourceHistoryTable">Jitter:</span>
              <span className="font-medium">
                {networkStatus.quality.jitter}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-6ResourceHistoryTable">Packet Loss:</span>
              <span className="font-medium">
                {networkStatus.quality.packetLoss}%
              </span>
            </div>

            {networkStatus.saveData && (
              <div className="flex justify-between">
                <span className="text-gray-6ResourceHistoryTable">Save Data:</span>
                <span className="font-medium text-green-6ResourceHistoryTable">Enabled</span>
              </div>
            )}

            {networkStatus.retryQueue.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-6ResourceHistoryTable">Pending Retries:</span>
                  <span className="font-medium">
                    {networkStatus.retryQueue.length}
                  </span>
                </div>
                
                {networkStatus.isProcessingRetries && (
                  <div className="text-xs text-blue-6ResourceHistoryTable flex items-center gap-1">
                    <IconRefresh className="w-3 h-3 animate-spin" />
                    Processing retries...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => networkStatus.refresh()}
              className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-6ResourceHistoryTable text-sm"
            >
              Refresh
            </button>
            
            {networkStatus.retryQueue.length > 0 && (
              <button
                onClick={() => networkStatus.processRetryQueue()}
                className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-6ResourceHistoryTable text-sm"
                disabled={networkStatus.isProcessingRetries || !networkStatus.isOnline}
              >
                Retry Now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};