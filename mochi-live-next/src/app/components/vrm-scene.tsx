'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadMixamoAnimation } from '../utils/loadMixamoAnimation';
import { frequencyToViseme, VisemeSmoother } from '../utils/frequencyToViseme';

interface VRMSceneProps {
  conversation?: {
    isSpeaking: boolean;
    getOutputByteFrequencyData: () => Uint8Array | undefined;
  };
}

export function VRMScene({ conversation }: VRMSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const greetingActionRef = useRef<THREE.AnimationAction | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const visemeSmootherRef = useRef<VisemeSmoother>(new VisemeSmoother());
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
      '/vrm/8622788685404555712.vrm',
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

        scene.add(vrm.scene);
        console.log('VRM model loaded successfully');

        // Load both animations
        loadAnimations(vrm);
      },
      (progress) => {
        console.log('Loading model...', 100 * (progress.loaded / progress.total), '%');
      },
      (error) => {
        console.error('Error loading VRM model:', error);
      }
    );

    // Weighted random selection: 75% idle, 25% greeting
    const selectNextAnimation = (): 'idle' | 'greeting' => {
      return Math.random() < 0.25 ? 'greeting' : 'idle';
    };

    // Play selected animation with crossfade
    const playAnimation = (type: 'idle' | 'greeting', crossfadeDuration: number = 0.5) => {
      const newAction = type === 'idle' ? idleActionRef.current : greetingActionRef.current;
      const oldAction = type === 'idle' ? greetingActionRef.current : idleActionRef.current;

      if (!newAction) return;

      // Stop old animation with fade out
      if (oldAction && oldAction.isRunning()) {
        oldAction.fadeOut(crossfadeDuration);
      }

      // Play new animation with fade in
      newAction.reset();
      newAction.fadeIn(crossfadeDuration);
      newAction.play();

      console.log(`🎬 Playing ${type} animation`);
    };

    // Load and apply Mixamo FBX animations with proper retargeting
    const loadAnimations = async (vrm: VRM) => {
      try {
        console.log('Loading animations...');

        // Create animation mixer for the VRM
        const mixer = new THREE.AnimationMixer(vrm.scene);
        mixerRef.current = mixer;

        // Load idle animation
        console.log('Loading idle animation...');
        const idleClip = await loadMixamoAnimation('/vrm/Idle.fbx', vrm);
        const idleAction = mixer.clipAction(idleClip);
        idleAction.setLoop(THREE.LoopOnce, 1);
        idleActionRef.current = idleAction;

        // Load greeting animation
        console.log('Loading greeting animation...');
        const greetingClip = await loadMixamoAnimation('/vrm/Standing Greeting.fbx', vrm);
        const greetingAction = mixer.clipAction(greetingClip);
        greetingAction.setLoop(THREE.LoopOnce, 1);
        greetingActionRef.current = greetingAction;

        console.log('Both animations loaded successfully');

        // Set up animation finished listener
        mixer.addEventListener('finished', () => {
          const nextAnimation = selectNextAnimation();
          playAnimation(nextAnimation, 0.3);
        });

        // Start with idle animation
        playAnimation('idle', 0);

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