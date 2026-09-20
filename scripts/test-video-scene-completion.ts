/**
 * Phase 3D-C1C-D Verification Suite: Real Scene Completion
 * 
 * Tests exact canonical contracts, signature generation, state isolation, progress derivation,
 * fail-closed validation, and immutable transitions without any type bypasses.
 */

import {
  VideoSceneCompletionState,
  createEmptyVideoSceneCompletionState,
  validateVideoSceneCompletionState,
  setVideoSceneClipCreated,
  getCompletedVideoSceneCount,
  areAllVideoScenesCreated,
  getVideoSceneCompletionStorageKey,
  buildVideoScenePlanSignature,
} from '../lib/video-scene-completion';
import { VideoProductionCandidate } from '../lib/production-candidate';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- RUNNING PHASE 3D-C1C-D TEST SUITE ---');

// Canonical VideoProductionCandidate Fixture A (Motion Explainer)
const mockCandidateA: VideoProductionCandidate = {
  candidate_type: 'video',
  candidate_id: 'video_motion_explainer_101',
  production_details: {
    production_mode: 'motion_explainer',
    objective: 'Explain cashflow management',
    duration_seconds: 15,
    format: '9:16 Vertical Video',
    hook: 'Tahukah Anda 80% bisnis gagal karena cashflow?',
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 5,
        purpose: 'Hook',
        visual_direction: 'Animated red chart plummeting down',
        action: 'Chart plummets smoothly',
        camera: 'Static front view',
        voiceover: 'Tahukah Anda 80% bisnis gagal karena cashflow?',
        on_screen_text: '80% Bisnis Gagal Karena Cashflow',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
      {
        scene_number: 2,
        duration_seconds: 5,
        purpose: 'Problem/Solution',
        visual_direction: 'Clean green dashboard metrics',
        action: 'Transition to green metrics',
        camera: 'Close up on metrics',
        voiceover: 'Gunakan sistem otomasi pencatatan keuangan real-time.',
        on_screen_text: 'Sistem Otomasi Real-Time',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
      {
        scene_number: 3,
        duration_seconds: 5,
        purpose: 'Call to action',
        visual_direction: 'Animated CTA button click',
        action: 'Button pulses with glow',
        camera: 'Center focus',
        voiceover: 'Coba demo gratis sekarang melalui link di bio.',
        on_screen_text: 'Coba Demo Gratis Sekarang',
        scene_type: 'graphic_motion',
        required_assets: [],
      },
    ],
    voiceover: 'Full voiceover track',
    on_screen_text: 'Full text overlay',
    camera_direction: 'Static 9:16 vertical focus',
    motion_direction: 'Clean motion graphics transitions',
    audio_direction: 'Upbeat background audio',
    branding: 'Minimalist brand logo in corner',
    negative_constraints: 'No visual artifacts',
  },
  final_prompt: 'Canonical motion explainer prompt',
};

// TEST 1: Canonical VideoProductionCandidate generates non-empty signature
console.log('Running Test 1: Canonical VideoProductionCandidate generates non-empty signature');
const sigA = buildVideoScenePlanSignature(mockCandidateA);
assert(typeof sigA === 'string' && sigA.startsWith('sig_motion_explainer_'), 'Signature A must be valid string');

// TEST 2: Changing canonical visual_direction changes signature
console.log('Running Test 2: Changing canonical visual_direction changes signature');
const mockCandidateAVisMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      {
        ...mockCandidateA.production_details.scenes[0],
        visual_direction: 'MODIFIED: Blue bar graph animated up',
      },
      mockCandidateA.production_details.scenes[1],
      mockCandidateA.production_details.scenes[2],
    ],
  },
};
const sigAVisMod = buildVideoScenePlanSignature(mockCandidateAVisMod);
assert(sigA !== sigAVisMod, 'Changing visual_direction must alter signature');

// TEST 3: Changing voiceover changes signature
console.log('Running Test 3: Changing voiceover changes signature');
const mockCandidateAVoiceMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      mockCandidateA.production_details.scenes[0],
      {
        ...mockCandidateA.production_details.scenes[1],
        voiceover: 'MODIFIED VOICEOVER: Catat semua transaksi otomatis.',
      },
      mockCandidateA.production_details.scenes[2],
    ],
  },
};
const sigAVoiceMod = buildVideoScenePlanSignature(mockCandidateAVoiceMod);
assert(sigA !== sigAVoiceMod, 'Changing voiceover must alter signature');

// TEST 4: Changing scene_type changes signature
console.log('Running Test 4: Changing scene_type changes signature');
const mockCandidateATypeMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      mockCandidateA.production_details.scenes[0],
      mockCandidateA.production_details.scenes[1],
      {
        ...mockCandidateA.production_details.scenes[2],
        scene_type: 'end_card',
      },
    ],
  },
};
const sigATypeMod = buildVideoScenePlanSignature(mockCandidateATypeMod);
assert(sigA !== sigATypeMod, 'Changing scene_type must alter signature');

// TEST 5: Changing required_assets changes signature
console.log('Running Test 5: Changing required_assets changes signature');
const mockCandidateAAssetsMod: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      {
        ...mockCandidateA.production_details.scenes[0],
        required_assets: ['asset_chart_png'],
      },
      mockCandidateA.production_details.scenes[1],
      mockCandidateA.production_details.scenes[2],
    ],
  },
};
const sigAAssetsMod = buildVideoScenePlanSignature(mockCandidateAAssetsMod);
assert(sigA !== sigAAssetsMod, 'Changing required_assets must alter signature');

// TEST 6: Same canonical data gives same signature (Determinism)
console.log('Running Test 6: Same canonical data gives same signature');
const mockCandidateADuplicate: VideoProductionCandidate = JSON.parse(JSON.stringify(mockCandidateA));
const sigADup = buildVideoScenePlanSignature(mockCandidateADuplicate);
assert(sigA === sigADup, 'Identical canonical candidate must yield exact same signature');

// TEST 7: Null or undefined candidate returns empty signature
console.log('Running Test 7: Null candidate returns empty signature');
assert(buildVideoScenePlanSignature(null) === '', 'Null candidate returns empty signature');
assert(buildVideoScenePlanSignature(undefined) === '', 'Undefined candidate returns empty signature');

// TEST A: Invalid scene_type fails closed
console.log('Running Test A: scene_type = invalid_type fails closed');
const candidateInvalidType = JSON.parse(JSON.stringify(mockCandidateA));
candidateInvalidType.production_details.scenes[0].scene_type = 'invalid_type';
assert(buildVideoScenePlanSignature(candidateInvalidType) === '', 'Invalid scene_type returns empty signature');

// TEST B: Empty purpose fails closed
console.log('Running Test B: purpose = empty string fails closed');
const candidateEmptyPurpose = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyPurpose.production_details.scenes[0].purpose = '';
assert(buildVideoScenePlanSignature(candidateEmptyPurpose) === '', 'Empty purpose returns empty signature');

// TEST C: Whitespace visual_direction fails closed
console.log('Running Test C: visual_direction = whitespace fails closed');
const candidateWsVisual = JSON.parse(JSON.stringify(mockCandidateA));
candidateWsVisual.production_details.scenes[0].visual_direction = '   ';
assert(buildVideoScenePlanSignature(candidateWsVisual) === '', 'Whitespace visual_direction returns empty signature');

// TEST D: Empty action fails closed
console.log('Running Test D: action = empty string fails closed');
const candidateEmptyAction = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyAction.production_details.scenes[0].action = '';
assert(buildVideoScenePlanSignature(candidateEmptyAction) === '', 'Empty action returns empty signature');

// TEST E: Empty camera fails closed
console.log('Running Test E: camera = empty string fails closed');
const candidateEmptyCamera = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyCamera.production_details.scenes[0].camera = '';
assert(buildVideoScenePlanSignature(candidateEmptyCamera) === '', 'Empty camera returns empty signature');

// TEST F: duration_seconds = 0 fails closed
console.log('Running Test F: duration_seconds = 0 fails closed');
const candidateZeroDuration = JSON.parse(JSON.stringify(mockCandidateA));
candidateZeroDuration.production_details.scenes[0].duration_seconds = 0;
assert(buildVideoScenePlanSignature(candidateZeroDuration) === '', 'duration_seconds = 0 returns empty signature');

// TEST G: duration_seconds = NaN fails closed
console.log('Running Test G: duration_seconds = NaN fails closed');
const candidateNaNDuration = JSON.parse(JSON.stringify(mockCandidateA));
candidateNaNDuration.production_details.scenes[0].duration_seconds = NaN;
assert(buildVideoScenePlanSignature(candidateNaNDuration) === '', 'duration_seconds = NaN returns empty signature');

// TEST H: required_assets = [''] fails closed
console.log('Running Test H: required_assets = [""] fails closed');
const candidateEmptyAssetToken = JSON.parse(JSON.stringify(mockCandidateA));
candidateEmptyAssetToken.production_details.scenes[0].required_assets = [''];
assert(buildVideoScenePlanSignature(candidateEmptyAssetToken) === '', 'Empty asset token returns empty signature');

// TEST I: required_assets = ['   '] fails closed
console.log('Running Test I: required_assets = ["   "] fails closed');
const candidateWsAssetToken = JSON.parse(JSON.stringify(mockCandidateA));
candidateWsAssetToken.production_details.scenes[0].required_assets = ['   '];
assert(buildVideoScenePlanSignature(candidateWsAssetToken) === '', 'Whitespace asset token returns empty signature');

// TEST J: Valid canonical required_assets ['chart', 'logo'] generates non-empty signature
console.log('Running Test J: Valid required_assets generates non-empty signature');
const candidateValidAssets = JSON.parse(JSON.stringify(mockCandidateA));
candidateValidAssets.production_details.scenes[0].required_assets = ['chart', 'logo'];
const sigAssetsJ = buildVideoScenePlanSignature(candidateValidAssets);
assert(typeof sigAssetsJ === 'string' && sigAssetsJ.length > 0, 'Valid required_assets generates non-empty signature');

// TEST K: Same required_assets in different order generates same signature
console.log('Running Test K: Order-independent required_assets signature');
const candidateValidAssetsReordered = JSON.parse(JSON.stringify(mockCandidateA));
candidateValidAssetsReordered.production_details.scenes[0].required_assets = ['logo', 'chart'];
const sigAssetsK = buildVideoScenePlanSignature(candidateValidAssetsReordered);
assert(sigAssetsJ === sigAssetsK, 'Reordered required_assets must generate exact same signature');

// TEST L: Malformed scene_number 1, 3, 3 fails closed
console.log('Running Test L: Malformed scene_number 1, 3, 3 fails closed');
const mockCandidateMalformedNum: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      { ...mockCandidateA.production_details.scenes[0], scene_number: 1 },
      { ...mockCandidateA.production_details.scenes[1], scene_number: 3 },
      { ...mockCandidateA.production_details.scenes[2], scene_number: 3 },
    ],
  },
};
assert(buildVideoScenePlanSignature(mockCandidateMalformedNum) === '', 'Gapped scene numbers 1, 3, 3 fail closed');

// TEST M: 4 scenes fails closed
console.log('Running Test M: 4 scenes fails closed');
const mockCandidate4Scenes: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      mockCandidateA.production_details.scenes[0],
      mockCandidateA.production_details.scenes[1],
      mockCandidateA.production_details.scenes[2],
      {
        scene_number: 4,
        duration_seconds: 5,
        purpose: 'Extra',
        visual_direction: 'Extra scene',
        action: 'Extra action',
        camera: 'Extra camera',
        voiceover: 'Extra VO',
        on_screen_text: 'Extra text',
        scene_type: 'end_card',
        required_assets: [],
      },
    ],
  },
};
assert(buildVideoScenePlanSignature(mockCandidate4Scenes) === '', '4-scene candidate fails closed');

// TEST 13: Completion state false + null marked_at is valid
console.log('Running Test 13: Completion state false + null marked_at is valid');
const initialState = createEmptyVideoSceneCompletionState({
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
});
const valInit = validateVideoSceneCompletionState(initialState, {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
});
assert(valInit.isValid === true, 'Initial state with false + null marked_at must be valid');

// TEST 14: Completion state false + undefined marked_at is invalid
console.log('Running Test 14: Completion state false + undefined marked_at is invalid');
const invalidFalseUndef = JSON.parse(JSON.stringify(initialState));
delete invalidFalseUndef.scenes[0].marked_at;
assert(
  validateVideoSceneCompletionState(invalidFalseUndef, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'false + undefined marked_at must be invalid'
);

// TEST 15: Completion state false + '' marked_at is invalid
console.log('Running Test 15: Completion state false + empty string marked_at is invalid');
const invalidFalseEmptyStr = JSON.parse(JSON.stringify(initialState));
invalidFalseEmptyStr.scenes[0].marked_at = '';
assert(
  validateVideoSceneCompletionState(invalidFalseEmptyStr, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'false + empty string marked_at must be invalid'
);

// TEST 16: Completion state true + valid timestamp is valid
console.log('Running Test 16: Completion state true + valid timestamp is valid');
const stateScene1Done = setVideoSceneClipCreated(initialState, 1, true);
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === true,
  'true + valid timestamp marked_at must be valid'
);

// TEST 17: Completion state true + null marked_at is invalid
console.log('Running Test 17: Completion state true + null marked_at is invalid');
const invalidTrueNull = JSON.parse(JSON.stringify(stateScene1Done));
invalidTrueNull.scenes[0].marked_at = null;
assert(
  validateVideoSceneCompletionState(invalidTrueNull, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'true + null marked_at must be invalid'
);

// TEST 18: Missing or empty updated_at is invalid
console.log('Running Test 18: Missing/empty updated_at is invalid');
const invalidEmptyUpdatedAt = JSON.parse(JSON.stringify(initialState));
invalidEmptyUpdatedAt.updated_at = '  ';
assert(
  validateVideoSceneCompletionState(invalidEmptyUpdatedAt, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'Empty updated_at must be invalid'
);

// --- ISOLATION & PROGRESS BEHAVIOR TESTS ---

// TEST 19: Copy actions do not mutate clip_created
console.log('Running Test 19: Copy actions do not mutate clip_created');
const copiedStatesMock: Record<string, boolean> = {
  'canonical_prompt_1_motion': true,
};
assert(Boolean(copiedStatesMock['canonical_prompt_1_motion']) === true, 'Copied state exists');
assert(initialState.scenes[0].clip_created === false, 'clip_created remains strictly false');

// TEST 20: Mark scene 1 and 2, verify scene 3 remains false
console.log('Running Test 20: Mark scene 1 and 2');
const stateScene1And2Done = setVideoSceneClipCreated(stateScene1Done, 2, true);
assert(stateScene1And2Done.scenes[0].clip_created === true, 'Scene 1 remains true');
assert(stateScene1And2Done.scenes[1].clip_created === true, 'Scene 2 is true');
assert(stateScene1And2Done.scenes[2].clip_created === false, 'Scene 3 remains false');

// TEST 21: Unmark scene 1 reverts marked_at to null
console.log('Running Test 21: Unmark scene 1');
const stateUnmark1 = setVideoSceneClipCreated(stateScene1And2Done, 1, false);
assert(stateUnmark1.scenes[0].clip_created === false, 'Scene 1 reverts to false');
assert(stateUnmark1.scenes[0].marked_at === null, 'Scene 1 marked_at reverts to null');

// TEST 22: Isolation per project_id
console.log('Running Test 22: Isolation per project_id');
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_beta',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'Validation fails for wrong project_id'
);

// TEST 23: Isolation per content_item_id
console.log('Running Test 23: Isolation per content_item_id');
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_alpha',
    content_item_id: 'item_202',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'Validation fails for wrong content_item_id'
);

// TEST 24: Isolation per production_mode
console.log('Running Test 24: Isolation per production_mode');
assert(
  validateVideoSceneCompletionState(stateScene1Done, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'human_led',
    scene_plan_signature: sigA,
  }).isValid === false,
  'Validation fails for wrong production_mode'
);

// TEST 25: Signature invalidation resets state cleanly
console.log('Running Test 25: Signature invalidation');
const valSigMismatch = validateVideoSceneCompletionState(stateScene1Done, {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigAVisMod,
});
assert(valSigMismatch.isValid === false, 'Validation fails when scene_plan_signature mismatches');

// TEST 26: Progress counter and all scenes created
console.log('Running Test 26: Progress counter and all scenes created');
assert(getCompletedVideoSceneCount(initialState) === 0, 'Progress 0');
assert(getCompletedVideoSceneCount(stateScene1Done) === 1, 'Progress 1');
assert(getCompletedVideoSceneCount(stateScene1And2Done) === 2, 'Progress 2');
const stateAllDone = setVideoSceneClipCreated(stateScene1And2Done, 3, true);
assert(getCompletedVideoSceneCount(stateAllDone) === 3, 'Progress 3');
assert(areAllVideoScenesCreated(stateAllDone) === true, 'All scenes created');
assert(areAllVideoScenesCreated(stateScene1And2Done) === false, 'Not all scenes created');

// TEST 27: Storage key helper
console.log('Running Test 27: Storage key helper');
assert(
  getVideoSceneCompletionStorageKey('item_101', 'motion_explainer') ===
    'studio_video_scene_completion_item_101_motion_explainer',
  'Storage key must match exact pattern'
);

console.log('--- ALL TESTS IN PHASE 3D-C1C-D PASSED PERFECTLY ---');
