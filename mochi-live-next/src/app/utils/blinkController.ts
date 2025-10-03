/**
 * BlinkController manages natural eye blinking for VRM avatars
 *
 * Features:
 * - Triggers blinks during audio pauses
 * - Prevents too frequent blinking (2-4 second cooldown)
 * - Smooth animation curve (quick close, slower open)
 * - Randomized timing for natural variation
 */

type BlinkState = 'idle' | 'closing' | 'opening';

export class BlinkController {
  private state: BlinkState = 'idle';
  private blinkValue: number = 0; // 0 = eyes open, 1 = eyes closed
  private lastBlinkTime: number = 0;
  private blinkStartTime: number = 0;

  // Timing configuration
  private readonly minCooldown = 2000; // Minimum 2 seconds between blinks
  private readonly maxCooldown = 4000; // Maximum 4 seconds between blinks
  private readonly closeDuration = 50; // Time to close eyes (quick)
  private readonly openDuration = 100; // Time to open eyes (slower)

  // Trigger configuration
  private readonly pauseThreshold = 0.15; // Audio intensity threshold for pause detection
  private readonly blinkChance = 0.3; // 30% chance to blink when conditions are met

  constructor() {
    this.lastBlinkTime = Date.now();
  }

  /**
   * Update blink state based on audio intensity
   * Call this every frame in the animation loop
   */
  update(audioIntensity: number): number {
    const now = Date.now();
    const timeSinceLastBlink = now - this.lastBlinkTime;

    // Update ongoing blink animation
    if (this.state !== 'idle') {
      this.updateBlinkAnimation(now);
      return this.blinkValue;
    }

    // Check if we should trigger a new blink
    const cooldownPassed = timeSinceLastBlink > this.minCooldown;
    const isInPause = audioIntensity < this.pauseThreshold;
    const shouldBlink = cooldownPassed && isInPause && Math.random() < this.blinkChance;

    // Also trigger periodic blinks if cooldown exceeded (even without audio pause)
    const forceBlink = timeSinceLastBlink > this.maxCooldown && Math.random() < 0.5;

    if (shouldBlink || forceBlink) {
      this.startBlink(now);
    }

    return this.blinkValue;
  }

  /**
   * Start a new blink animation
   */
  private startBlink(now: number): void {
    this.state = 'closing';
    this.blinkStartTime = now;
    this.lastBlinkTime = now;
    console.log('👁️ Blink triggered');
  }

  /**
   * Update the blink animation curve
   */
  private updateBlinkAnimation(now: number): void {
    const elapsed = now - this.blinkStartTime;

    if (this.state === 'closing') {
      // Quick closing phase
      const progress = Math.min(1, elapsed / this.closeDuration);
      this.blinkValue = this.easeInQuad(progress);

      if (progress >= 1) {
        this.state = 'opening';
        this.blinkStartTime = now;
      }
    } else if (this.state === 'opening') {
      // Slower opening phase
      const progress = Math.min(1, elapsed / this.openDuration);
      this.blinkValue = 1 - this.easeOutQuad(progress);

      if (progress >= 1) {
        this.state = 'idle';
        this.blinkValue = 0;
      }
    }
  }

  /**
   * Ease-in quadratic curve (accelerating)
   */
  private easeInQuad(t: number): number {
    return t * t;
  }

  /**
   * Ease-out quadratic curve (decelerating)
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Get current blink value (0-1)
   */
  getValue(): number {
    return this.blinkValue;
  }

  /**
   * Reset controller state
   */
  reset(): void {
    this.state = 'idle';
    this.blinkValue = 0;
    this.lastBlinkTime = Date.now();
  }
}
