import { describe, it, expect } from 'vitest';
import { 
  getMockActivities, 
  getMockDailyStats, 
  getMockSleepData,
  getMockTrainingLoad,
  getMockHeartRateZones,
  getMockRecoveryMetrics,
  getMockDataSync
} from './garmin-mock';

describe('garmin-mock', () => {
  describe('getMockActivities', () => {
    it('should return array of activities with all required fields', () => {
      const activities = getMockActivities(5);
      
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBe(5);
      
      activities.forEach(activity => {
        expect(activity).toHaveProperty('activityId');
        expect(activity).toHaveProperty('activityName');
        expect(activity).toHaveProperty('activityType');
        expect(activity).toHaveProperty('startTimeLocal');
        expect(activity).toHaveProperty('distance');
        expect(activity).toHaveProperty('duration');
        expect(activity).toHaveProperty('averageHeartRate');
        expect(activity).toHaveProperty('calories');
        
        expect(typeof activity.activityId).toBe('number');
        expect(typeof activity.activityName).toBe('string');
        expect(typeof activity.distance).toBe('number');
        expect(typeof activity.duration).toBe('number');
      });
    });

    it('should return different activities each time', () => {
      const activities1 = getMockActivities(3);
      const activities2 = getMockActivities(3);
      
      expect(activities1).not.toBe(activities2); // Different array instances
      expect(activities1).toEqual(activities2); // But same content
    });

    it('should limit results correctly', () => {
      const activities = getMockActivities(3);
      expect(activities.length).toBe(3);
    });
  });

  describe('getMockDailyStats', () => {
    it('should return valid daily stats', () => {
      const stats = getMockDailyStats();
      
      expect(stats).toHaveProperty('date');
      expect(stats).toHaveProperty('steps');
      expect(stats).toHaveProperty('restingHeartRate');
      expect(stats).toHaveProperty('maxHeartRate');
      
      expect(typeof stats.date).toBe('string');
      expect(typeof stats.steps).toBe('number');
      expect(stats.steps).toBeGreaterThan(0);
      expect(stats.restingHeartRate).toBeGreaterThan(30);
      expect(stats.restingHeartRate).toBeLessThan(100);
    });

    it('should have today\'s date', () => {
      const stats = getMockDailyStats();
      const today = new Date().toISOString().split('T')[0];
      expect(stats.date).toBe(today);
    });
  });

  describe('getMockSleepData', () => {
    it('should return valid sleep data', () => {
      const sleep = getMockSleepData();
      
      expect(sleep).toHaveProperty('dailySleepDTO');
      expect(sleep).toHaveProperty('restingHeartRate');
      expect(sleep).toHaveProperty('avgOvernightHrv');
      expect(sleep).toHaveProperty('hrvStatus');
      
      const sleepDTO = sleep.dailySleepDTO;
      expect(sleepDTO).toBeDefined();
      expect(sleepDTO?.sleepTimeSeconds).toBeGreaterThan(0);
      expect(sleepDTO?.deepSleepSeconds).toBeGreaterThan(0);
      expect(sleepDTO?.lightSleepSeconds).toBeGreaterThan(0);
    });

    it('should have realistic sleep durations', () => {
      const sleep = getMockSleepData();
      const dto = sleep.dailySleepDTO;
      
      expect(dto?.sleepTimeSeconds).toBeGreaterThan(14400); // At least 4 hours
      expect(dto?.sleepTimeSeconds).toBeLessThan(36000); // Less than 10 hours
      
      const totalSleepTime = (dto?.deepSleepSeconds || 0) + 
                            (dto?.lightSleepSeconds || 0) + 
                            (dto?.remSleepSeconds || 0) + 
                            (dto?.awakeSleepSeconds || 0);
      
      expect(totalSleepTime).toBe(dto?.sleepTimeSeconds);
    });
  });

  describe('getMockTrainingLoad', () => {
    it('should return training load data for 30 days', () => {
      const trainingLoad = getMockTrainingLoad();
      
      expect(Array.isArray(trainingLoad)).toBe(true);
      expect(trainingLoad.length).toBe(30);
      
      trainingLoad.forEach(load => {
        expect(load).toHaveProperty('date');
        expect(load).toHaveProperty('acuteTrainingLoad');
        expect(load).toHaveProperty('chronicTrainingLoad');
        expect(load).toHaveProperty('trainingStressBalance');
        expect(load).toHaveProperty('rampRate');
        
        expect(typeof load.date).toBe('string');
        expect(typeof load.acuteTrainingLoad).toBe('number');
        expect(typeof load.chronicTrainingLoad).toBe('number');
      });
    });

    it('should have dates in chronological order', () => {
      const trainingLoad = getMockTrainingLoad();
      
      for (let i = 1; i < trainingLoad.length; i++) {
        const prevDate = new Date(trainingLoad[i - 1].date);
        const currDate = new Date(trainingLoad[i].date);
        expect(currDate.getTime()).toBeGreaterThan(prevDate.getTime());
      }
    });

    it('should have realistic training load values', () => {
      const trainingLoad = getMockTrainingLoad();
      
      trainingLoad.forEach(load => {
        expect(load.acuteTrainingLoad).toBeGreaterThan(0);
        expect(load.acuteTrainingLoad).toBeLessThan(200);
        expect(load.chronicTrainingLoad).toBeGreaterThan(0);
        expect(load.chronicTrainingLoad).toBeLessThan(200);
        expect(Math.abs(load.rampRate)).toBeLessThan(100);
      });
    });
  });

  describe('getMockHeartRateZones', () => {
    it('should return valid heart rate zones', () => {
      const zones = getMockHeartRateZones();
      
      expect(zones).toHaveProperty('zone1Min');
      expect(zones).toHaveProperty('zone1Max');
      expect(zones).toHaveProperty('zone2Min');
      expect(zones).toHaveProperty('zone2Max');
      expect(zones).toHaveProperty('lactateThreshold');
      expect(zones).toHaveProperty('maxHeartRate');
      
      // Zones should be progressive
      expect(zones.zone2Min).toBe(zones.zone1Max);
      expect(zones.zone3Min).toBe(zones.zone2Max);
      expect(zones.zone4Min).toBe(zones.zone3Max);
      expect(zones.zone5Min).toBe(zones.zone4Max);
    });

    it('should have realistic heart rate values', () => {
      const zones = getMockHeartRateZones();
      
      expect(zones.zone1Min).toBeGreaterThan(40);
      expect(zones.maxHeartRate).toBeLessThan(220);
      expect(zones.lactateThreshold).toBeGreaterThan(zones.zone2Max);
      expect(zones.lactateThreshold).toBeLessThan(zones.maxHeartRate);
    });
  });

  describe('getMockRecoveryMetrics', () => {
    it('should return recovery metrics for 14 days', () => {
      const recovery = getMockRecoveryMetrics();
      
      expect(Array.isArray(recovery)).toBe(true);
      expect(recovery.length).toBe(14);
      
      recovery.forEach(metric => {
        expect(metric).toHaveProperty('date');
        expect(metric).toHaveProperty('stressLevel');
        expect(metric).toHaveProperty('bodyBattery');
        expect(metric).toHaveProperty('vo2Max');
        expect(metric).toHaveProperty('trainingReadiness');
        
        expect(typeof metric.date).toBe('string');
        expect(typeof metric.stressLevel).toBe('number');
        expect(typeof metric.bodyBattery).toBe('number');
        expect(['low', 'moderate', 'high', 'optimal']).toContain(metric.trainingReadiness);
      });
    });

    it('should have realistic recovery values', () => {
      const recovery = getMockRecoveryMetrics();
      
      recovery.forEach(metric => {
        expect(metric.stressLevel).toBeGreaterThanOrEqual(0);
        expect(metric.stressLevel).toBeLessThanOrEqual(100);
        expect(metric.bodyBattery).toBeGreaterThanOrEqual(0);
        expect(metric.bodyBattery).toBeLessThanOrEqual(100);
        expect(metric.vo2Max).toBeGreaterThan(20);
        expect(metric.vo2Max).toBeLessThan(80);
        expect(metric.recoveryTime).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getMockDataSync', () => {
    it('should return valid sync data', () => {
      const sync = getMockDataSync();
      
      expect(sync).toHaveProperty('lastSyncTime');
      expect(sync).toHaveProperty('filesProcessed');
      expect(sync).toHaveProperty('totalActivities');
      expect(sync).toHaveProperty('dateRange');
      expect(sync).toHaveProperty('errors');
      
      expect(typeof sync.lastSyncTime).toBe('string');
      expect(typeof sync.totalActivities).toBe('number');
      expect(Array.isArray(sync.errors)).toBe(true);
    });

    it('should have valid file processing counts', () => {
      const sync = getMockDataSync();
      
      expect(sync.filesProcessed).toHaveProperty('activities');
      expect(sync.filesProcessed).toHaveProperty('sleepFiles');
      expect(sync.filesProcessed).toHaveProperty('hrFiles');
      expect(sync.filesProcessed).toHaveProperty('trainingFiles');
      
      expect(sync.filesProcessed.activities).toBeGreaterThan(0);
      expect(sync.filesProcessed.sleepFiles).toBeGreaterThan(0);
      expect(sync.filesProcessed.hrFiles).toBeGreaterThan(0);
      expect(sync.filesProcessed.trainingFiles).toBeGreaterThan(0);
    });

    it('should have valid date range', () => {
      const sync = getMockDataSync();
      
      expect(sync.dateRange).toHaveProperty('earliest');
      expect(sync.dateRange).toHaveProperty('latest');
      
      const earliest = new Date(sync.dateRange.earliest);
      const latest = new Date(sync.dateRange.latest);
      
      expect(earliest.getTime()).toBeLessThan(latest.getTime());
    });

    it('should update last sync time on each call', () => {
      const sync1 = getMockDataSync();
      
      // Wait a tiny bit and call again
      setTimeout(() => {
        const sync2 = getMockDataSync();
        expect(sync2.lastSyncTime).not.toBe(sync1.lastSyncTime);
      }, 10);
    });
  });
});