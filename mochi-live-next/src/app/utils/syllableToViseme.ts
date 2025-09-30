/**
 * Map syllables and phonemes to VRM viseme expressions
 */

export type VisemeType = 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'neutral';

export interface VisemeFrame {
  viseme: VisemeType;
  duration: number; // milliseconds
  intensity: number; // 0-1
}

/**
 * Map a vowel sound to a viseme
 */
function vowelToViseme(vowel: string): VisemeType {
  const lower = vowel.toLowerCase();

  // Map common vowel sounds to visemes
  if (lower.match(/a|ah|ay|ai/)) return 'aa'; // "cat", "say"
  if (lower.match(/e|ee|ea|ey/)) return 'ee'; // "see", "tea"
  if (lower.match(/i|ih|y/)) return 'ih';     // "sit", "gym"
  if (lower.match(/o|oh|ow|aw/)) return 'oh'; // "go", "saw"
  if (lower.match(/u|oo|uh|ou/)) return 'ou'; // "food", "you"

  return 'neutral';
}

/**
 * Simple syllable parser - splits text into approximate syllables
 */
function parseIntoSyllables(text: string): string[] {
  // Remove punctuation and extra spaces
  const cleaned = text.replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();

  // Split into words
  const words = cleaned.split(' ');
  const syllables: string[] = [];

  for (const word of words) {
    // Very simple syllable splitting based on vowel patterns
    // This is a basic approximation
    const wordSyllables = word.match(/[^aeiou]*[aeiou]+(?:[^aeiou]*$|[^aeiou](?=[^aeiou]))?/gi) || [word];
    syllables.push(...wordSyllables);
  }

  return syllables.filter(s => s.length > 0);
}

/**
 * Convert text into a sequence of viseme frames
 */
export function textToVisemeFrames(text: string, speechRate: number = 2.5): VisemeFrame[] {
  // speechRate = syllables per second (default ~2.5 = natural speech)
  const syllableDuration = 1000 / speechRate; // ms per syllable

  const syllables = parseIntoSyllables(text);
  const frames: VisemeFrame[] = [];

  for (const syllable of syllables) {
    // Extract the primary vowel sound
    const vowelMatch = syllable.match(/[aeiou]+/i);

    if (vowelMatch) {
      const vowel = vowelMatch[0];
      const viseme = vowelToViseme(vowel);

      // Add the viseme frame
      frames.push({
        viseme,
        duration: syllableDuration,
        intensity: 0.7 + Math.random() * 0.3, // 0.7-1.0 for natural variation
      });
    } else {
      // Consonant-only syllable, use brief neutral
      frames.push({
        viseme: 'neutral',
        duration: syllableDuration * 0.5,
        intensity: 0,
      });
    }
  }

  // Add a final neutral frame
  frames.push({
    viseme: 'neutral',
    duration: 200,
    intensity: 0,
  });

  return frames;
}

/**
 * Get the current viseme based on elapsed time
 */
export function getCurrentViseme(frames: VisemeFrame[], elapsedMs: number): { viseme: VisemeType; intensity: number } | null {
  let currentTime = 0;

  for (const frame of frames) {
    currentTime += frame.duration;

    if (elapsedMs < currentTime) {
      return {
        viseme: frame.viseme,
        intensity: frame.intensity,
      };
    }
  }

  return null; // All frames played
}