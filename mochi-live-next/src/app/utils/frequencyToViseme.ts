/**
 * Frequency-to-Viseme analyzer
 * Analyzes audio frequency data to determine appropriate mouth shape (viseme)
 * Based on principles from wawa-lipsync but adapted for use with frequency data
 */

export type VisemeType = 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'neutral';

interface FrequencyFeatures {
  lowFreq: number;    // 0-500 Hz
  midFreq: number;    // 500-2000 Hz
  highFreq: number;   // 2000-8000 Hz
  volume: number;     // Overall volume
  centroid: number;   // Spectral centroid (brightness)
}

/**
 * Extract features from frequency data
 */
function extractFeatures(frequencyData: Uint8Array, sampleRate: number = 44100): FrequencyFeatures {
  const binCount = frequencyData.length;
  const binWidth = (sampleRate / 2) / binCount;

  let lowFreq = 0, midFreq = 0, highFreq = 0;
  let lowCount = 0, midCount = 0, highCount = 0;
  let totalMagnitude = 0;
  let weightedSum = 0;

  for (let i = 0; i < binCount; i++) {
    const frequency = i * binWidth;
    const magnitude = frequencyData[i];

    totalMagnitude += magnitude;
    weightedSum += frequency * magnitude;

    if (frequency < 500) {
      lowFreq += magnitude;
      lowCount++;
    } else if (frequency < 2000) {
      midFreq += magnitude;
      midCount++;
    } else if (frequency < 8000) {
      highFreq += magnitude;
      highCount++;
    }
  }

  // Average the bands
  lowFreq = lowCount > 0 ? lowFreq / lowCount : 0;
  midFreq = midCount > 0 ? midFreq / midCount : 0;
  highFreq = highCount > 0 ? highFreq / highCount : 0;

  // Calculate spectral centroid (brightness measure)
  const centroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;

  // Calculate overall volume
  const volume = totalMagnitude / binCount;

  return { lowFreq, midFreq, highFreq, volume, centroid };
}

/**
 * Determine viseme from frequency features
 */
export function frequencyToViseme(frequencyData: Uint8Array | undefined): { viseme: VisemeType; intensity: number } {
  if (!frequencyData || frequencyData.length === 0) {
    return { viseme: 'neutral', intensity: 0 };
  }

  const features = extractFeatures(frequencyData);

  // Silence detection
  if (features.volume < 10) {
    return { viseme: 'neutral', intensity: 0 };
  }

  // Normalize intensity based on volume (0-1 range)
  const intensity = Math.min(1.0, features.volume / 100);

  // Determine viseme based on frequency distribution
  // These thresholds are heuristic and may need tuning

  // High low freq + mid freq, low high freq → 'aa' (open mouth, like "father")
  if (features.lowFreq > 30 && features.midFreq > 25 && features.centroid < 2000) {
    return { viseme: 'aa', intensity };
  }

  // High mid + high freq, moderate low → 'ee' (smile, like "see")
  if (features.midFreq > 30 && features.highFreq > 20 && features.centroid > 2500) {
    return { viseme: 'ee', intensity };
  }

  // Moderate across all, centroid in mid range → 'ih' (relaxed, like "sit")
  if (features.midFreq > 25 && features.centroid > 1500 && features.centroid < 2500) {
    return { viseme: 'ih', intensity };
  }

  // High low freq, moderate mid, low high → 'oh' (rounded, like "go")
  if (features.lowFreq > 35 && features.midFreq > 20 && features.highFreq < 20) {
    return { viseme: 'oh', intensity };
  }

  // Very high low freq, lower mid/high → 'ou' (very rounded, like "you")
  if (features.lowFreq > 40 && features.centroid < 1500) {
    return { viseme: 'ou', intensity };
  }

  // Default to neutral for ambiguous cases
  return { viseme: 'neutral', intensity: intensity * 0.5 };
}

/**
 * Smooth viseme transitions
 */
export class VisemeSmoother {
  private history: Array<{ viseme: VisemeType; intensity: number; timestamp: number }> = [];
  private readonly historySize = 5; // Keep last 5 frames
  private readonly minDuration = 50; // Minimum duration in ms for a viseme change

  add(viseme: VisemeType, intensity: number): { viseme: VisemeType; intensity: number } {
    const now = Date.now();

    // Add to history
    this.history.push({ viseme, intensity, timestamp: now });

    // Trim history
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    // If we don't have enough history, return current
    if (this.history.length < 3) {
      return { viseme, intensity };
    }

    // Find most common viseme in recent history
    const counts = new Map<VisemeType, number>();
    let totalIntensity = 0;

    for (const entry of this.history) {
      counts.set(entry.viseme, (counts.get(entry.viseme) || 0) + 1);
      totalIntensity += entry.intensity;
    }

    // Get most frequent viseme
    let maxCount = 0;
    let mostFrequent: VisemeType = 'neutral';

    for (const [v, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = v;
      }
    }

    // Average intensity
    const avgIntensity = totalIntensity / this.history.length;

    return { viseme: mostFrequent, intensity: avgIntensity };
  }

  reset() {
    this.history = [];
  }
}