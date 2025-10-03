'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadMixamoAnimation } from '../utils/loadMixamoAnimation';
import { frequencyToViseme, VisemeSmoother } from '../utils/frequencyToViseme';
import { BlinkController } from '../utils/blinkController';

interface VRMSceneProps {
  conversation?: {
    isSpeaking: boolean;
    getOutputByteFrequencyData: () => Uint8Array | undefined;
  };
  animationTrigger?: {
    animation: string;
    timestamp: number;
  } | null;
}

export function VRMScene({ conversation, animationTrigger }: VRMSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const greetingActionRef = useRef<THREE.AnimationAction | null>(null);
  const waveHipHopActionRef = useRef<THREE.AnimationAction | null>(null);
  const northernSoulSpinActionRef = useRef<THREE.AnimationAction | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const visemeSmootherRef = useRef<VisemeSmoother>(new VisemeSmoother());
  const blinkControllerRef = useRef<BlinkController>(new BlinkController());
  const playAnimationRef = useRef<((type: 'idle' | 'greeting' | 'waveHipHop' | 'northernSoulSpin', crossfadeDuration?: number) => void) | null>(null);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('🎬 Initializing VRM Scene (this should only happen once)');

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x212121);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.4, 2);
    camera.lookAt(0, 1.2, 0);

    // WebGL Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-1, 1, -1);
    scene.add(backLight);

    // Setup camera controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.update();

    // Load VRM model
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      '/vrm/mochi-2.vrm',
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        vrmRef.current = vrm;

        // Rotate model 180 degrees to face camera
        VRMUtils.rotateVRM0(vrm);

        // Position arms down the sides
        const humanoid = vrm.humanoid;

        const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
        const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
        const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
        const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');

        if (leftUpperArm) {
          leftUpperArm.rotation.z = 0.5; // Rotate arm down (~28° from horizontal)
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = -0.5; // Rotate arm down (~28° from horizontal)
        }
        if (leftLowerArm) {
          leftLowerArm.rotation.z = 0; // Keep lower arm straight
        }
        if (rightLowerArm) {
          rightLowerArm.rotation.z = 0; // Keep lower arm straight
        }

        // Hide model initially to prevent T-pose flash
        vrm.scene.visible = false;

        scene.add(vrm.scene);
        console.log('VRM model loaded successfully');

        // Load animations and show model when idle starts
        loadAnimations(vrm);
      },
      (progress) => {
        console.log('Loading model...', 100 * (progress.loaded / progress.total), '%');
      },
      (error) => {
        console.error('Error loading VRM model:', error);
      }
    );

    // Always return to idle after any animation finishes
    const selectNextAnimation = (): 'idle' | 'greeting' | 'waveHipHop' | 'northernSoulSpin' => {
      return 'idle';
    };

    // Play selected animation with crossfade
    const playAnimation = (type: 'idle' | 'greeting' | 'waveHipHop' | 'northernSoulSpin', crossfadeDuration: number = 0.5) => {
      // Map animation type to action ref
      const animationActions: Record<string, THREE.AnimationAction | null> = {
        idle: idleActionRef.current,
        greeting: greetingActionRef.current,
        waveHipHop: waveHipHopActionRef.current,
        northernSoulSpin: northernSoulSpinActionRef.current,
      };

      const newAction = animationActions[type];

      if (!newAction) return;

      console.log(`🎬 === Starting transition to: ${type} ===`);

      // Log current state before transition
      Object.entries(animationActions).forEach(([key, action]) => {
        if (action) {
          console.log(`  ${key}: running=${action.isRunning()}, weight=${action.getEffectiveWeight().toFixed(3)}, time=${action.time.toFixed(3)}/${action.getClip().duration.toFixed(3)}`);
        }
      });

      // Special handling when transitioning TO idle
      if (type === 'idle') {
        // Fade out and stop all one-shot animations (including paused ones)
        Object.entries(animationActions).forEach(([key, action]) => {
          if (action && key !== 'idle') {
            const isActive = action.isRunning() || action.paused;
            if (isActive) {
              console.log(`  🛑 Fading out and stopping: ${key} (paused: ${action.paused})`);
              action.fadeOut(crossfadeDuration);

              // CRITICAL FIX: Delay stop/reset until AFTER fadeOut completes
              // This ensures the animation maintains weight during the entire crossfade
              setTimeout(() => {
                action.enabled = false; // Break bone influence
                action.paused = false;
                action.stop();
                action.reset();
                console.log(`  ✅ Cleanup complete for: ${key}`);
              }, crossfadeDuration * 1000);
            }
          }
        });

        // Idle should always be playing in background, just fade it back in
        if (!newAction.isRunning()) {
          console.log(`  ▶️ Restarting idle (was stopped)`);
          newAction.play();
        } else {
          console.log(`  ⬆️ Fading in idle (was running at time: ${newAction.time.toFixed(3)})`);
        }
      } else {
        // When transitioning FROM idle to one-shot animation
        // Fade out idle (but keep it running in background)
        if (idleActionRef.current && idleActionRef.current.isRunning()) {
          console.log(`  ⬇️ Fading out: idle (weight: ${idleActionRef.current.getEffectiveWeight().toFixed(3)} → 0)`);
          idleActionRef.current.fadeOut(crossfadeDuration);
        }

        // Reset one-shot animations to start from beginning
        console.log(`  🔄 Resetting ${type} to frame 0`);
        newAction.reset();
      }

      // Enable and play new animation with fade in
      newAction.enabled = true;
      newAction.setEffectiveTimeScale(1);
      newAction.setEffectiveWeight(1);
      console.log(`  ⬆️ Fading in: ${type} (weight: ${newAction.getEffectiveWeight().toFixed(3)} → 1)`);
      newAction.fadeIn(crossfadeDuration);
      if (type !== 'idle') {
        newAction.play();
      }

      console.log(`🎬 === Transition to ${type} started ===\n`);
    };

    // Store playAnimation function in ref for external access
    playAnimationRef.current = playAnimation;

    // Load and apply Mixamo FBX animations with proper retargeting
    const loadAnimations = async (vrm: VRM) => {
      try {
        console.log('Loading animations...');

        // Create animation mixer for the VRM
        const mixer = new THREE.AnimationMixer(vrm.scene);
        mixerRef.current = mixer;

        // Load idle animation
        console.log('Loading idle animation...');
        const idleClip = await loadMixamoAnimation('/animations/Idle.fbx', vrm);
        const idleAction = mixer.clipAction(idleClip);
        idleAction.setLoop(THREE.LoopRepeat, Infinity); // Loop idle continuously
        idleActionRef.current = idleAction;
        console.log(`  ✅ Idle loaded: duration=${idleClip.duration.toFixed(3)}s, tracks=${idleClip.tracks.length}`);

        // Load greeting animation
        console.log('Loading greeting animation...');
        const greetingClip = await loadMixamoAnimation('/animations/Standing Greeting.fbx', vrm);
        const greetingAction = mixer.clipAction(greetingClip);
        greetingAction.setLoop(THREE.LoopOnce, 1);
        greetingAction.clampWhenFinished = true; // Hold last frame to avoid T-pose
        greetingActionRef.current = greetingAction;
        console.log(`  ✅ Greeting loaded: duration=${greetingClip.duration.toFixed(3)}s, tracks=${greetingClip.tracks.length}`);

        // Load wave hip hop dance animation
        console.log('Loading wave hip hop dance animation...');
        const waveHipHopClip = await loadMixamoAnimation('/animations/Wave Hip Hop Dance.fbx', vrm);
        const waveHipHopAction = mixer.clipAction(waveHipHopClip);
        waveHipHopAction.setLoop(THREE.LoopOnce, 1);
        waveHipHopAction.clampWhenFinished = true; // Hold last frame to avoid T-pose
        waveHipHopAction.timeScale = 0.7; // Slow down to 70% speed
        waveHipHopActionRef.current = waveHipHopAction;
        console.log(`  ✅ Wave Hip Hop loaded: duration=${waveHipHopClip.duration.toFixed(3)}s (slowed to ${(waveHipHopClip.duration / 0.7).toFixed(3)}s), tracks=${waveHipHopClip.tracks.length}`);

        // Load northern soul spin animation
        console.log('Loading northern soul spin animation...');
        const northernSoulSpinClip = await loadMixamoAnimation('/animations/Northern Soul Spin.fbx', vrm);
        const northernSoulSpinAction = mixer.clipAction(northernSoulSpinClip);
        northernSoulSpinAction.setLoop(THREE.LoopOnce, 1);
        northernSoulSpinAction.clampWhenFinished = true; // Hold last frame to avoid T-pose
        northernSoulSpinAction.timeScale = 0.7; // Slow down to 70% speed
        northernSoulSpinActionRef.current = northernSoulSpinAction;
        console.log(`  ✅ Northern Soul Spin loaded: duration=${northernSoulSpinClip.duration.toFixed(3)}s (slowed to ${(northernSoulSpinClip.duration / 0.7).toFixed(3)}s), tracks=${northernSoulSpinClip.tracks.length}`);

        console.log('All animations loaded successfully');

        // Set up animation finished listener
        mixer.addEventListener('finished', () => {
          const nextAnimation = selectNextAnimation();
          playAnimation(nextAnimation, 0.5); // Longer fade for smoother transition
        });

        // Start with idle animation and show model
        playAnimation('idle', 0);

        // Show model now that idle animation is playing
        if (vrmRef.current) {
          vrmRef.current.scene.visible = true;
          console.log('✨ Model visible with idle animation');
        }

      } catch (error) {
        console.error('Error loading animations:', error);
      }
    };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      const deltaTime = clockRef.current.getDelta();

      // Update animation mixer
      if (mixerRef.current) {
        mixerRef.current.update(deltaTime);
      }

      // Update VRM if loaded
      if (vrmRef.current && vrmRef.current.expressionManager) {
        // Get audio frequency data from ElevenLabs
        const frequencyData = conversation?.getOutputByteFrequencyData();

        // Analyze frequency data to get viseme
        const rawViseme = frequencyToViseme(frequencyData);

        // Smooth the viseme transitions
        const smoothedViseme = visemeSmootherRef.current.add(rawViseme.viseme, rawViseme.intensity);

        // Update volume display
        setVolume(rawViseme.intensity * 100);

        // Update blinking based on audio intensity
        const blinkValue = blinkControllerRef.current.update(smoothedViseme.intensity);

        // Reset all visemes first
        const allVisemes = ['aa', 'ee', 'ih', 'oh', 'ou'];
        allVisemes.forEach(v => {
          vrmRef.current?.expressionManager?.setValue(v, 0);
        });

        // Apply current viseme
        if (smoothedViseme.viseme !== 'neutral' && smoothedViseme.intensity > 0.1) {
          vrmRef.current.expressionManager.setValue(
            smoothedViseme.viseme,
            smoothedViseme.intensity
          );
        }

        // Apply blink expression
        if (blinkValue > 0) {
          vrmRef.current.expressionManager.setValue('blink', blinkValue);
        }

        vrmRef.current.update(deltaTime);
      }

      // Update controls
      controls.update();

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();

      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Handle external animation triggers
  useEffect(() => {
    if (!animationTrigger || !playAnimationRef.current) return;

    console.log('🎮 Animation trigger received:', animationTrigger);

    // Map animation names to animation types
    const animationMap: Record<string, 'idle' | 'greeting' | 'waveHipHop' | 'northernSoulSpin'> = {
      'greeting': 'greeting',
      'idle': 'idle',
      'hiphopdance': 'waveHipHop',
      'wavehiphopdance': 'waveHipHop',
      'northernsoulspin': 'northernSoulSpin',
      'spin': 'northernSoulSpin',
    };

    const animationType = animationMap[animationTrigger.animation.toLowerCase()];

    if (animationType) {
      playAnimationRef.current(animationType, 0.5);
    } else {
      console.warn(`⚠️ Unknown animation: ${animationTrigger.animation}`);
    }
  }, [animationTrigger]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {/* AI speaking status indicator */}
      {conversation && (
        <div className="fixed top-4 right-4 bg-black/50 text-white p-4 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${conversation.isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-sm">
              {conversation.isSpeaking ? 'AI Speaking' : 'AI Idle'}
            </span>
          </div>

          {conversation.isSpeaking && (
            <div className="space-y-1">
              <div className="text-xs text-gray-300">Volume: {volume.toFixed(0)}</div>
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-100"
                  style={{ width: `${Math.min(100, volume)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}