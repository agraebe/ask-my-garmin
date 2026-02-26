import { describe, it, expect } from 'vitest';
import { FitParser, parseMockFitFile } from './fit-parser';

describe('FitParser', () => {
  it('should parse FIT file header correctly', () => {
    // Create a minimal FIT file buffer for testing
    const buffer = Buffer.alloc(20);
    buffer.write('.FIT', 0); // FIT signature
    buffer.writeUInt8(14, 0); // Header size
    buffer.writeUInt8(16, 1); // Protocol version
    buffer.writeUInt16LE(2132, 2); // Profile version
    buffer.writeUInt32LE(100, 4); // Data size
    buffer.write('.FIT', 8); // Data type

    const parser = new FitParser(buffer);
    
    expect(() => parser.parse()).not.toThrow();
  });

  it('should throw error for invalid FIT signature', () => {
    const buffer = Buffer.alloc(20);
    buffer.write('NOPE', 0); // Invalid signature

    const parser = new FitParser(buffer);
    
    expect(() => parser.parse()).toThrow('Invalid FIT file signature');
  });

  it('should generate mock activity data for running', () => {
    const activity = parseMockFitFile('morning-run.fit');
    
    expect(activity.sport).toBe('running');
    expect(activity.totalDistance).toBeGreaterThan(0);
    expect(activity.avgHeartRate).toBeGreaterThan(0);
    expect(activity.sessions).toHaveLength(1);
    expect(activity.sessions[0].laps).toHaveLength(2);
  });

  it('should generate mock activity data for cycling', () => {
    const activity = parseMockFitFile('evening-bike-ride.fit');
    
    expect(activity.sport).toBe('cycling');
    expect(activity.totalDistance).toBeGreaterThan(10000); // Should be longer distance
    expect(activity.avgSpeed).toBeGreaterThan(5); // Should be faster than running
    expect(activity.sessions).toHaveLength(1);
  });

  it('should generate mock activity data for swimming', () => {
    const activity = parseMockFitFile('pool-swim.fit');
    
    expect(activity.sport).toBe('swimming');
    expect(activity.totalDistance).toBeLessThan(5000); // Swimming distances are shorter
    expect(activity.avgSpeed).toBeLessThan(3); // Swimming is slower
  });

  it('should include required activity fields', () => {
    const activity = parseMockFitFile('test-activity.fit');
    
    expect(activity).toHaveProperty('timestamp');
    expect(activity).toHaveProperty('sport');
    expect(activity).toHaveProperty('totalTimerTime');
    expect(activity).toHaveProperty('sessions');
    
    expect(typeof activity.timestamp).toBe('string');
    expect(typeof activity.sport).toBe('string');
    expect(typeof activity.totalTimerTime).toBe('number');
    expect(Array.isArray(activity.sessions)).toBe(true);
  });

  it('should have properly structured sessions and laps', () => {
    const activity = parseMockFitFile('test-run.fit');
    
    expect(activity.sessions.length).toBeGreaterThan(0);
    
    const session = activity.sessions[0];
    expect(session).toHaveProperty('timestamp');
    expect(session).toHaveProperty('totalTimerTime');
    expect(session).toHaveProperty('laps');
    
    expect(Array.isArray(session.laps)).toBe(true);
    expect(session.laps.length).toBeGreaterThan(0);
    
    const lap = session.laps[0];
    expect(lap).toHaveProperty('timestamp');
    expect(lap).toHaveProperty('totalTimerTime');
    expect(lap).toHaveProperty('totalDistance');
  });

  it('should generate realistic heart rate values', () => {
    const activity = parseMockFitFile('cardio-workout.fit');
    
    expect(activity.avgHeartRate).toBeGreaterThan(100);
    expect(activity.avgHeartRate).toBeLessThan(200);
    expect(activity.maxHeartRate).toBeGreaterThanOrEqual(activity.avgHeartRate);
    expect(activity.maxHeartRate).toBeLessThan(220);
  });

  it('should generate realistic speed and distance values', () => {
    const activity = parseMockFitFile('long-run.fit');
    
    expect(activity.totalDistance).toBeGreaterThan(0);
    expect(activity.avgSpeed).toBeGreaterThan(0);
    expect(activity.maxSpeed).toBeGreaterThanOrEqual(activity.avgSpeed);
    
    // Speed should be in reasonable range for running (1-6 m/s)
    expect(activity.avgSpeed).toBeLessThan(10);
  });
});