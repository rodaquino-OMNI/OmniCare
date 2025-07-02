/**
 * Enhanced Network Status Indicator for Clinical Workflows
 * Provides clinical-context aware network status and offline capabilities
 */

import React, { useState, useEffect } from 'react';
import { 
  IconWifi, 
  IconWifiOff, 
  IconAlertTriangle, 
  IconInfoCircle, 
  IconX, 
  IconRefresh,
  IconHeartbeat,
  IconNotes,
  IconPaperclip,
  IconMicrophone,
  IconClock,
  IconShield,
  IconUser,
  IconStethoscope
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { getClinicalOfflineSyncService, ClinicalSyncStatus } from '@/services/offline-sync-enhanced.service';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface ClinicalNetworkIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showClinicalDetails?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  patientContext?: {
    patientId: string;
    patientName: string;
    isActivePatient: boolean;
  };
}

export const ClinicalNetworkIndicator: React.FC<ClinicalNetworkIndicatorProps> = ({
  position = 'bottom-right',
  showClinicalDetails = true,
  autoHide = true,
  autoHideDelay = 5000,
  patientContext
}) => {
  const networkStatus = useNetworkStatus();
  const [isVisible, setIsVisible] = useState(!networkStatus.isOnline);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [clinicalStatus, setClinicalStatus] = useState<ClinicalSyncStatus | null>(null);
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

  // Load clinical sync status
  useEffect(() => {
    const loadClinicalStatus = async () => {
      try {
        const clinicalSyncService = getClinicalOfflineSyncService();
        const status = clinicalSyncService.getClinicalSyncStatus();
        setClinicalStatus(status);
      } catch (error) {
        console.error('Failed to load clinical sync status:', error);
      }
    };

    loadClinicalStatus();
    const interval = setInterval(loadClinicalStatus, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-hide logic
  useEffect(() => {
    if (!networkStatus.isOnline || networkStatus.quality === 'poor') {
      setIsVisible(true);
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        setAutoHideTimer(null);
      }
    } else if (autoHide && isVisible && !showDetailPanel) {
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
  }, [networkStatus.isOnline, networkStatus.quality, autoHide, autoHideDelay, isVisible, showDetailPanel]);

  // Calculate pending clinical operations
  const getPendingClinicalOperations = () => {
    if (!clinicalStatus) return 0;
    
    return (
      (clinicalStatus.clinicalSyncProgress?.notes.pending || 0) +
      (clinicalStatus.clinicalSyncProgress?.attachments.pending || 0) +
      (clinicalStatus.clinicalSyncProgress?.workflows.pending || 0)
    );
  };

  const getClinicalStatusColor = () => {
    if (!networkStatus.isOnline) return 'bg-red-50 border-red-200 text-red-700';
    if (clinicalStatus?.isSyncing) return 'bg-blue-50 border-blue-200 text-blue-700';
    if (getPendingClinicalOperations() > 0) return 'bg-orange-50 border-orange-200 text-orange-700';
    return 'bg-green-50 border-green-200 text-green-700';
  };

  const getClinicalStatusIcon = () => {
    if (!networkStatus.isOnline) return <IconWifiOff className="w-5 h-5" />;
    if (clinicalStatus?.isSyncing) return <IconRefresh className="w-5 h-5 animate-spin" />;
    if (getPendingClinicalOperations() > 0) return <IconClock className="w-5 h-5" />;
    return <IconHeartbeat className="w-5 h-5" />;
  };

  const getClinicalStatusText = () => {
    if (!networkStatus.isOnline) return 'Clinical Offline';
    if (clinicalStatus?.isSyncing) return 'Syncing Data';
    
    const pending = getPendingClinicalOperations();
    if (pending > 0) return `${pending} Pending`;
    
    return 'Clinical Online';
  };

  if (!isVisible) return null;

  return (
    <div className={cn('fixed z-50 flex flex-col gap-2', positionClasses[position])}>
      {/* Main Clinical Status Indicator */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border transition-all cursor-pointer',
          getClinicalStatusColor()
        )}
        onClick={() => showClinicalDetails && setShowDetailPanel(!showDetailPanel)}
      >
        {getClinicalStatusIcon()}
        <span className="font-medium">{getClinicalStatusText()}</span>

        {/* Patient Context */}
        {patientContext?.isActivePatient && (
          <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-blue-100 rounded-full text-blue-700">
            <IconUser className="w-3 h-3" />
            <span className="text-xs font-medium">Active</span>
          </div>
        )}

        {/* Pending Operations Badge */}
        {getPendingClinicalOperations() > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
              {getPendingClinicalOperations()}
            </span>
          </div>
        )}

        {showClinicalDetails && (
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
      </div>

      {/* Detailed Clinical Panel */}
      {showDetailPanel && (
        <div className="bg-white rounded-lg shadow-xl border p-4 min-w-[350px] max-w-[400px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <IconStethoscope className="w-5 h-5" />
              Clinical Status
            </h3>
            <button
              onClick={() => setShowDetailPanel(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Network Status Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Network Status</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Connection:</span>
                  <span className="font-medium">
                    {networkStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Quality:</span>
                  <span className="font-medium capitalize">
                    {networkStatus.quality || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Patient Context */}
            {patientContext && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Patient Context</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <IconUser className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{patientContext.patientName}</span>
                    {patientContext.isActivePatient && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    Cache Status: {clinicalStatus?.patientDataCacheStatus || 'Unknown'}
                  </div>
                </div>
              </div>
            )}

            {/* Clinical Data Sync Status */}
            {clinicalStatus && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Clinical Data</h4>
                <div className="space-y-2">
                  
                  {/* Clinical Notes */}
                  <div className="flex items-center justify-between bg-blue-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <IconNotes className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Notes</span>
                    </div>
                    <div className="text-sm">
                      {clinicalStatus.clinicalSyncProgress?.notes ? (
                        <span>
                          {clinicalStatus.clinicalSyncProgress.notes.pending > 0 ? (
                            <span className="text-orange-600">
                              {clinicalStatus.clinicalSyncProgress.notes.pending} pending
                            </span>
                          ) : (
                            <span className="text-green-600">
                              {clinicalStatus.clinicalSyncProgress.notes.synced} synced
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">Ready</span>
                      )}
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="flex items-center justify-between bg-purple-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <IconPaperclip className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">Attachments</span>
                    </div>
                    <div className="text-sm">
                      {clinicalStatus.clinicalSyncProgress?.attachments ? (
                        <span>
                          {clinicalStatus.clinicalSyncProgress.attachments.pending > 0 ? (
                            <span className="text-orange-600">
                              {clinicalStatus.clinicalSyncProgress.attachments.pending} pending
                            </span>
                          ) : (
                            <span className="text-green-600">
                              {clinicalStatus.clinicalSyncProgress.attachments.synced} synced
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">Ready</span>
                      )}
                    </div>
                  </div>

                  {/* Workflows */}
                  <div className="flex items-center justify-between bg-green-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <IconHeartbeat className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Workflows</span>
                    </div>
                    <div className="text-sm">
                      {clinicalStatus.clinicalSyncProgress?.workflows ? (
                        <span>
                          {clinicalStatus.clinicalSyncProgress.workflows.pending > 0 ? (
                            <span className="text-orange-600">
                              {clinicalStatus.clinicalSyncProgress.workflows.pending} pending
                            </span>
                          ) : (
                            <span className="text-green-600">
                              {clinicalStatus.clinicalSyncProgress.workflows.synced} synced
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">Ready</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {clinicalStatus && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Performance</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="text-gray-600">
                    Avg Note Sync: {clinicalStatus.averageNoteSync?.toFixed(0) || 0}ms
                  </div>
                  <div className="text-gray-600">
                    Offline Time: {Math.round(clinicalStatus.offlineTimeSpent || 0)}min
                  </div>
                </div>
              </div>
            )}

            {/* Offline Warning */}
            {!networkStatus.isOnline && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <IconShield className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">
                    Working Offline
                  </span>
                </div>
                <div className="text-xs text-amber-700">
                  All clinical data is being saved locally and encrypted. 
                  Changes will sync automatically when connection is restored.
                </div>
              </div>
            )}

            {/* Last Sync Time */}
            {clinicalStatus?.lastSyncAt && (
              <div className="text-xs text-gray-500 text-center pt-2 border-t">
                Last sync: {new Date(clinicalStatus.lastSyncAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Refresh
            </button>
            
            {networkStatus.isOnline && getPendingClinicalOperations() > 0 && (
              <button
                onClick={async () => {
                  try {
                    const clinicalSyncService = getClinicalOfflineSyncService();
                    await clinicalSyncService.syncClinicalData();
                  } catch (error) {
                    console.error('Manual sync failed:', error);
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                disabled={clinicalStatus?.isSyncing}
              >
                {clinicalStatus?.isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalNetworkIndicator;