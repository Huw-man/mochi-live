import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

/**
 * Load a Mixamo animation, convert it for three-vrm use, and return it.
 *
 * @param url A url of mixamo animation data
 * @param vrm A target VRM
 * @returns The loaded animation clip
 */
export async function loadMixamoAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
  const loader = new FBXLoader();
  const asset = await loader.loadAsync(url);

  const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com');
  if (!clip) {
    throw new Error('Animation clip not found in FBX file');
  }

    const tracks: THREE.KeyframeTrack[] = [];

    const restRotationInverse = new THREE.Quaternion();
    const parentRestWorldRotation = new THREE.Quaternion();
    const _quatA = new THREE.Quaternion();
    const _vec3 = new THREE.Vector3();

    // Adjust with reference to hips height.
    const motionHipsHeight = asset.getObjectByName('mixamorigHips')?.position.y;
    const vrmHipsY = vrm.humanoid?.getNormalizedBoneNode('hips')?.getWorldPosition(_vec3).y;
    const vrmRootY = vrm.scene.getWorldPosition(_vec3).y;
    const vrmHipsHeight = Math.abs(vrmHipsY! - vrmRootY);
    const hipsPositionScale = vrmHipsHeight / motionHipsHeight!;

    clip.tracks.forEach((track) => {
      // Convert each track to match VRM model
      const trackSplitted = track.name.split('.');
      const mixamoRigName = trackSplitted[0];
      const vrmBoneName = mixamoVRMRigMap[mixamoRigName] as VRMHumanBoneName;
      const vrmNodeName = vrmBoneName ? vrm.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name : undefined;
      const mixamoRigNode = asset.getObjectByName(mixamoRigName);

      if (vrmNodeName != null) {
        const propertyName = trackSplitted[1];

        // Store rotations of rest-pose.
        mixamoRigNode?.getWorldQuaternion(restRotationInverse).invert();
        mixamoRigNode?.parent?.getWorldQuaternion(parentRestWorldRotation);

        if (track instanceof THREE.QuaternionKeyframeTrack) {
          // Retarget rotation of mixamoRig to NormalizedBone.
          for (let i = 0; i < track.values.length; i += 4) {
            const flatQuaternion = track.values.slice(i, i + 4);

            _quatA.fromArray(flatQuaternion);

            // 親のレスト時ワールド回転 * トラックの回転 * レスト時ワールド回転の逆
            _quatA
              .premultiply(parentRestWorldRotation)
              .multiply(restRotationInverse);

            _quatA.toArray(flatQuaternion);

            flatQuaternion.forEach((v, index) => {
              track.values[index + i] = v;
            });
          }

          tracks.push(
            new THREE.QuaternionKeyframeTrack(
              `${vrmNodeName}.${propertyName}`,
              track.times,
              track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v)),
            ),
          );
        } else if (track instanceof THREE.VectorKeyframeTrack) {
          const value = track.values.map(
            (v, i) => (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale,
          );
          tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, value));
        }
      }
    });

    return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
}

/**
 * Mixamo bone name to VRM humanoid bone name map
 */
const mixamoVRMRigMap: { [key: string]: string } = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
};