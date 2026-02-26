# Sample Garmin FIT Files

This directory contains example parsed FIT file data to demonstrate the structure and content of Garmin fitness files.

## File Types

### Activity Files (`.fit`)
- `example-run.fit.json` - 5-mile training run with heart rate data
- `example-bike-ride.fit.json` - 25-mile cycling workout with power data

### Sleep Files (`.fit`)
- `example-sleep.fit.json` - Full night's sleep with detailed stage breakdown

## File Structure

Each parsed FIT file follows this general structure:

```json
{
  "description": "Human-readable description",
  "metadata": {
    "fileType": "activity|sleep|monitoring",
    "sport": "running|cycling|swimming|...",
    "parsedAt": "ISO timestamp",
    "originalFileSize": "bytes"
  },
  "activity|sleepData": {
    // Main data payload specific to file type
  }
}
```

## Activity File Details

Activity files contain:
- **Basic metrics**: duration, distance, calories
- **Heart rate data**: zones, average, maximum
- **Power data** (cycling): normalized power, zones, TSS
- **GPS tracking**: coordinates, elevation
- **Lap data**: splits with detailed metrics per lap/mile
- **Session data**: overall workout summary

## Sleep File Details

Sleep files contain:
- **Sleep stages**: deep, light, REM, awake periods
- **Sleep scores**: overall quality ratings
- **Recovery metrics**: HRV, resting heart rate
- **Body Battery**: energy levels throughout night
- **Stress levels**: overnight stress patterns

## Usage

These files can be used to:
1. Test FIT file parsing functionality
2. Validate data structure expectations
3. Develop training analysis algorithms
4. Create mock data for testing purposes

## Real FIT Files

In a production environment, these would be binary `.fit` files from actual Garmin devices. The JSON format here represents the parsed, structured data after processing through the FIT SDK.

## Data Privacy

All sample data uses realistic but fictional values. Real user data should always be handled with appropriate privacy protections.