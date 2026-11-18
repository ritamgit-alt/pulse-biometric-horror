// src/main/preload.js
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 1. Initialize the official SmartSpectra preload IPC bridge
try {
  require('@smartspectra/node-sdk/preload');
} catch (e) {
  console.warn('[Preload] Could not load official SmartSpectra preload bridge:', e);
}

const { SmartSpectraSDK } = require('@smartspectra/node-sdk/renderer');
const { decodeMetrics } = require('@smartspectra/node-sdk/messages');
const {
  MetricType,
  cardioMetrics,
  breathingMetrics,
} = require('@smartspectra/node-sdk');

let activeSdkInstance = null;
let metricsCallbacks = [];
let qualityCallbacks = [];
let statusCallbacks = [];

contextBridge.exposeInMainWorld('smartspectra', {
  getApiKeyFromEnv: () => {
    return process.env.PRESAGE_API_KEY || process.env.SMARTSPECTRA_API_KEY || '';
  },

  configure: async (options = {}) => {
    try {
      const apiKey = options.apiKey || process.env.PRESAGE_API_KEY || process.env.SMARTSPECTRA_API_KEY || '';
      
      // Request both cardio and breathing metrics
      const requested = [
        ...cardioMetrics,
        ...breathingMetrics,
      ];

      activeSdkInstance = new SmartSpectraSDK({
        apiKey,
        requestedMetrics: requested,
        enableTelemetry: false,
      });

      // Wire metrics event
      activeSdkInstance.on('metrics', (buffer, timestampUs) => {
        try {
          const decoded = decodeMetrics(buffer);
          let pulseRate = 0;
          let breathingRate = 0;
          let hrv = 0;

          // Extract latest pulse rate
          if (decoded.cardio && Array.isArray(decoded.cardio.pulseRate) && decoded.cardio.pulseRate.length > 0) {
            const latest = decoded.cardio.pulseRate[decoded.cardio.pulseRate.length - 1];
            pulseRate = latest.value || 0;
          }

          // Extract latest breathing rate
          if (decoded.breathing && Array.isArray(decoded.breathing.rate) && decoded.breathing.rate.length > 0) {
            const latest = decoded.breathing.rate[decoded.breathing.rate.length - 1];
            breathingRate = latest.value || 0;
          }

          // Extract latest HRV
          if (decoded.cardio && Array.isArray(decoded.cardio.hrv) && decoded.cardio.hrv.length > 0) {
            const latestHrv = decoded.cardio.hrv[decoded.cardio.hrv.length - 1];
            hrv = latestHrv.rmssd || latestHrv.sdnn || (latestHrv.value || 0);
          }

          const parsed = {
            pulseRate,
            breathingRate,
            hrv,
            raw: decoded,
            timestampUs,
          };

          metricsCallbacks.forEach((cb) => cb(parsed));
        } catch (err) {
          console.error('[Preload] Failed to decode metrics:', err);
        }
      });

      // Wire validation / quality status
      activeSdkInstance.on('validationStatus', (code, timestampUs, hint) => {
        const isGood = code === 0;
        const status = {
          code,
          hint: hint || (isGood ? 'good' : 'adjusting'),
          quality: isGood ? 'good' : 'adjusting',
        };
        qualityCallbacks.forEach((cb) => cb(status));
      });

      activeSdkInstance.on('processingStatus', (status) => {
        statusCallbacks.forEach((cb) => cb(status));
      });

      activeSdkInstance.on('error', (code, message) => {
        console.error(`[Preload] SmartSpectra SDK error [${code}]:`, message);
      });

      return { success: true };
    } catch (err) {
      console.warn('[Preload] SDK configure failed, will use fallback simulation:', err.message);
      return { success: false, error: err.message };
    }
  },

  useMediaStream: (stream) => {
    if (activeSdkInstance && stream) {
      activeSdkInstance.useMediaStream(stream);
    }
  },

  start: async () => {
    if (activeSdkInstance) {
      return await activeSdkInstance.start();
    }
  },

  stop: async () => {
    if (activeSdkInstance) {
      return await activeSdkInstance.stop();
    }
  },

  on: (event, cb) => {
    if (event === 'metrics') metricsCallbacks.push(cb);
    if (event === 'quality') qualityCallbacks.push(cb);
    if (event === 'status') statusCallbacks.push(cb);
  },
});
