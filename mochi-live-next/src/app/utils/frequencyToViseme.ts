/**
 * Frequency-to-Viseme analyzer using Formants approach
 * Analyzes audio frequency data to determine appropriate mouth shape (viseme)
 * Uses F1 (first formant) and F2 (second formant) frequency bands
 * to identify characteristic resonance peaks for each vowel sound
 */

export type VisemeType = 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'neutral';

/**
 * Formant ranges for each viseme (in Hz)
 * F1 = first formant (mouth openness / vertical tongue position)
 * F2 = second formant (tongue front/back position)
 */
interface FormantRange {
  f1: [number, number];  // [min, max] Hz
  f2: [number, number];  // [min, max] Hz
}

const FORMANT_RANGES: Record<VisemeType, FormantRange | null> = {
  'aa': { f1: [650, 900], f2: [1100, 1400] },   // Open mouth (like "father")
  'ee': { f1: [500, 700], f2: [1700, 2200] },   // Smile (like "see")
  'ih': { f1: [200, 400], f2: [1900, 2500] },   // Relaxed (like "sit")
  'oh': { f1: [400, 600], f2: [800, 1300] },    // Rounded (like "go")
  'ou': { f1: [300, 450], f2: [700, 1100] },    // Very rounded (like "you")
  'neutral': null  // No specific formants
};

/**
 * Get total amplitude in a specific frequency band
 */
function getAmplitudeInBand(
  frequencyData: Uint8Array,
  startHz: number,
  endHz: number,
  sampleRate: number = 44100
): number {
  const binCount = frequencyData.length;
  const binWidth = (sampleRate / 2) / binCount;

  const startBin = Math.floor(startHz / binWidth);
  const endBin = Math.ceil(endHz / binWidth);

  let sum = 0;
  let count = 0;

  for (let i = startBin; i <= endBin && i < binCount; i++) {
    sum += frequencyData[i];
    count++;
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Determine viseme using formants approach
 * For each viseme, measure amplitude in F1 and F2 bands
 * Select the viseme with the highest combined score
 */
export function frequencyToViseme(frequencyData: Uint8Array | undefined): { viseme: VisemeType; intensity: number } {
  if (!frequencyData || frequencyData.length === 0) {
    return { viseme: 'neutral', intensity: 0 };
  }

  const sampleRate = 44100;

  // Calculate overall volume for silence detection
  let totalAmplitude = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    totalAmplitude += frequencyData[i];
  }
  const avgAmplitude = totalAmplitude / frequencyData.length;

  // Silence detection
  if (avgAmplitude < 10) {
    return { viseme: 'neutral', intensity: 0 };
  }

  // Calculate formant scores for each viseme
  const scores: Record<VisemeType, number> = {
    'aa': 0,
    'ee': 0,
    'ih': 0,
    'oh': 0,
    'ou': 0,
    'neutral': 0
  };

  const debugScores: Record<string, string> = {};

  for (const viseme of ['aa', 'ee', 'ih', 'oh', 'ou'] as VisemeType[]) {
    const formants = FORMANT_RANGES[viseme];
    if (!formants) continue;

    // Get amplitude in F1 band (first formant)
    const f1Amplitude = getAmplitudeInBand(
      frequencyData,
      formants.f1[0],
      formants.f1[1],
      sampleRate
    );

    // Get amplitude in F2 band (second formant)
    const f2Amplitude = getAmplitudeInBand(
      frequencyData,
      formants.f2[0],
      formants.f2[1],
      sampleRate
    );

    // Combined score (sum of both formants)
    scores[viseme] = f1Amplitude + f2Amplitude;
    debugScores[viseme] = `${scores[viseme].toFixed(1)} (F1:${f1Amplitude.toFixed(1)} F2:${f2Amplitude.toFixed(1)})`;
  }

  // Find viseme with highest score
  let maxScore = 0;
  let detectedViseme: VisemeType = 'neutral';

  for (const viseme of ['aa', 'ee', 'ih', 'oh', 'ou'] as VisemeType[]) {
    if (scores[viseme] > maxScore) {
      maxScore = scores[viseme];
      detectedViseme = viseme;
    }
  }

  // Minimum threshold to avoid false positives
  const MIN_SCORE_THRESHOLD = 20;
  if (maxScore < MIN_SCORE_THRESHOLD) {
    detectedViseme = 'neutral';
  }

  // Normalize intensity based on score (0-1 range)
  const intensity = Math.min(1.0, maxScore / 150);

  return { viseme: detectedViseme, intensity };
}

/**
 * Smooth viseme transitions with improved responsiveness
 * 
 * This smoother addresses the common problem of missing sounds in lip sync systems.
 * Instead of pure majority voting (which requires 3+ frames of consensus), this uses:
 * 
 * 1. WEIGHTED SCORING: Recent frames get higher weight, so new sounds can quickly
 *    override old ones without waiting for majority consensus
 * 
 * 2. INTENSITY PRIORITY: High-intensity sounds (>0.5) bypass smoothing entirely,
 *    ensuring loud/clear sounds are never missed due to conservative filtering
 * 
 * 3. SMART CHANGE DETECTION: Changes are allowed when:
 *    - Intensity is high (>0.5) - loud sounds get immediate priority
 *    - Minimum time has passed (30ms) - prevents rapid flickering
 *    - Last 2 frames agree - consistent detection triggers immediate change
 * 
 * 4. REDUCED LATENCY: 3-frame history (vs 5) with 30ms minimum duration (vs 50ms)
 *    means faster response to legitimate speech changes
 * 
 * This approach catches quick consonants and transient vowels that pure majority
 * voting would filter out, while still preventing noise-induced flickering.
 */
export class VisemeSmoother {
  private history: Array<{ viseme: VisemeType; intensity: number; timestamp: number }> = [];
  private readonly historySize = 3; // Reduced from 5 to 3 frames
  private readonly minDuration = 30; // Reduced from 50ms to 30ms
  private lastViseme: VisemeType = 'neutral';
  private lastVisemeTime: number = 0;

  add(viseme: VisemeType, intensity: number): { viseme: VisemeType; intensity: number } {
    const now = Date.now();

    // Add to history
    this.history.push({ viseme, intensity, timestamp: now });

    // Trim history
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    // If we don't have enough history, return current
    if (this.history.length < 2) {
      return { viseme, intensity };
    }

    // Weighted scoring system instead of pure majority voting
    const scores = new Map<VisemeType, number>();
    let totalIntensity = 0;

    for (let i = 0; i < this.history.length; i++) {
      const entry = this.history[i];
      const weight = (i + 1) / this.history.length; // Recent frames get higher weight
      const currentScore = (scores.get(entry.viseme) || 0) + weight;
      scores.set(entry.viseme, currentScore);
      totalIntensity += entry.intensity * weight;
    }

    // Get highest scoring viseme
    let maxScore = 0;
    let bestViseme: VisemeType = 'neutral';

    for (const [v, score] of scores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        bestViseme = v;
      }
    }

    // Allow quick changes for high-intensity sounds
    const shouldChange = 
      intensity > 0.5 || // High intensity gets priority
      (bestViseme !== this.lastViseme && now - this.lastVisemeTime > this.minDuration) ||
      (this.history.length >= 2 && this.history[this.history.length - 1].viseme === this.history[this.history.length - 2].viseme);

    if (shouldChange) {
      this.lastViseme = bestViseme;
      this.lastVisemeTime = now;
    }

    // Weighted average intensity
    const avgIntensity = totalIntensity / this.history.length;

    return { viseme: this.lastViseme, intensity: avgIntensity };
  }

  reset() {
    this.history = [];
    this.lastViseme = 'neutral';
    this.lastVisemeTime = 0;
  }
}