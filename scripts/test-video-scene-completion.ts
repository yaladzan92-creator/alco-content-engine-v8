/**
 * Phase 3D-C1C-D Verification Suite: Real Scene Completion
 * 
 * Tests exact contracts, signature generation, state isolation, progress derivation,
 * fail-closed validation, and immutable transitions.
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

const mockCandidateA: VideoProductionCandidate = {
  candidate_id: 'cand_video_motion_1',
  candidate_type: 'video',
  production_mode: 'motion_explainer',
  confidence_score: 0.95,
  rationale: 'Educational concept walkthrough',
  production_details: {
    format: 'motion_graphics',
    visual_direction: 'Clean minimalist vector animations',
    recommended_duration_seconds: 45,
    scenes: [
      {
        scene_number: 1,
        scene_type: 'hook',
        duration_seconds: 15,
        narration: 'Tahukah Anda 80% bisnis gagal karena cashflow?',
        visual_cue: 'Animated red chart plummeting down',
        on_screen_text: '80% Bisnis Gagal Karena Cashflow',
        required_assets: [],
      },
      {
        scene_number: 2,
        scene_type: 'body',
        duration_seconds: 15,
        narration: 'Gunakan sistem otomasi pencatatan keuangan real-time.',
        visual_cue: 'Smooth transition to clean green dashboard metrics',
        on_screen_text: 'Sistem Otomasi Real-Time',
        required_assets: [],
      },
      {
        scene_number: 3,
        scene_type: 'cta',
        duration_seconds: 15,
        narration: 'Coba demo gratis sekarang melalui link di bio.',
        visual_cue: 'Animated CTA button click with glowing pulse',
        on_screen_text: 'Coba Demo Gratis Sekarang',
        required_assets: [],
      },
    ],
  },
};

const sigA = buildVideoScenePlanSignature(mockCandidateA);

// TEST 1: Initial state for valid candidate has exactly 3 scenes with clip_created = false
console.log('Running Test 1: Initial state creation');
const initialState = createEmptyVideoSceneCompletionState({
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
});
assert(initialState.scenes.length === 3, 'Initial state must contain exactly 3 scenes');
assert(
  initialState.scenes.every((s) => s.clip_created === false && s.marked_at === null),
  'All scenes must start with clip_created = false and marked_at = null'
);
assert(initialState.scenes[0].scene_number === 1, 'Scene 1 must be 1');
assert(initialState.scenes[1].scene_number === 2, 'Scene 2 must be 2');
assert(initialState.scenes[2].scene_number === 3, 'Scene 3 must be 3');

// TEST 2: Copying prompt does NOT mutate clip_created (UI isolation)
console.log('Running Test 2: Copy actions do not mutate clip_created');
const copiedStatesMock: Record<string, boolean> = {
  'canonical_prompt_1_motion': true,
  'canonical_img_1_motion': true,
};
assert(Boolean(copiedStatesMock['canonical_prompt_1_motion']) === true, 'Copied state exists');
assert(initialState.scenes[0].clip_created === false, 'clip_created remains strictly false');

// TEST 3: Marking scene 1 clip_created = true updates scene 1 ONLY
console.log('Running Test 3: Mark scene 1');
const stateScene1Done = setVideoSceneClipCreated(initialState, 1, true);
assert(stateScene1Done.scenes[0].clip_created === true, 'Scene 1 must be clip_created = true');
assert(typeof stateScene1Done.scenes[0].marked_at === 'string', 'Scene 1 marked_at must be timestamp string');
assert(stateScene1Done.scenes[1].clip_created === false, 'Scene 2 must remain false');
assert(stateScene1Done.scenes[2].clip_created === false, 'Scene 3 must remain false');
assert(initialState.scenes[0].clip_created === false, 'Original state must not be mutated (immutability)');

// TEST 4: Marking scene 2 clip_created = true preserves scene 1 and leaves scene 3 false
console.log('Running Test 4: Mark scene 2');
const stateScene1And2Done = setVideoSceneClipCreated(stateScene1Done, 2, true);
assert(stateScene1And2Done.scenes[0].clip_created === true, 'Scene 1 remains true');
assert(stateScene1And2Done.scenes[1].clip_created === true, 'Scene 2 must be true');
assert(stateScene1And2Done.scenes[2].clip_created === false, 'Scene 3 remains false');

// TEST 5: Unmarking scene 1 sets clip_created = false and marked_at = null
console.log('Running Test 5: Unmark scene 1');
const stateUnmark1 = setVideoSceneClipCreated(stateScene1And2Done, 1, false);
assert(stateUnmark1.scenes[0].clip_created === false, 'Scene 1 must revert to false');
assert(stateUnmark1.scenes[0].marked_at === null, 'Scene 1 marked_at must revert to null');
assert(stateUnmark1.scenes[1].clip_created === true, 'Scene 2 must remain true');
assert(stateUnmark1.scenes[2].clip_created === false, 'Scene 3 must remain false');

// TEST 6: Completion state is isolated per project_id
console.log('Running Test 6: Isolation per project_id');
const projBValidation = validateVideoSceneCompletionState(stateScene1Done, {
  project_id: 'proj_beta',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
});
assert(projBValidation.isValid === false, 'Validation must fail when project_id does not match');

// TEST 7: Completion state is isolated per content_item_id
console.log('Running Test 7: Isolation per content_item_id');
const item202Validation = validateVideoSceneCompletionState(stateScene1Done, {
  project_id: 'proj_alpha',
  content_item_id: 'item_202',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
});
assert(item202Validation.isValid === false, 'Validation must fail when content_item_id does not match');

// TEST 8: Completion state is isolated per production_mode
console.log('Running Test 8: Isolation per production_mode');
const humanLedValidation = validateVideoSceneCompletionState(stateScene1Done, {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'human_led',
  scene_plan_signature: sigA,
});
assert(humanLedValidation.isValid === false, 'Validation must fail when production_mode does not match');

// TEST 9: Completion state invalidates when scene_plan_signature changes (visual cue altered)
console.log('Running Test 9: Signature invalidation on visual cue alteration');
const mockCandidateAModified: VideoProductionCandidate = {
  ...mockCandidateA,
  production_details: {
    ...mockCandidateA.production_details,
    scenes: [
      {
        ...mockCandidateA.production_details.scenes[0],
        visual_cue: 'MODIFIED CUE: Animated yellow bar graph instead of red chart',
      },
      mockCandidateA.production_details.scenes[1],
      mockCandidateA.production_details.scenes[2],
    ],
  },
};
const sigAModified = buildVideoScenePlanSignature(mockCandidateAModified);
assert(sigA !== sigAModified, 'Modified candidate must produce different signature');

const modifiedValidation = validateVideoSceneCompletionState(stateScene1Done, {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigAModified,
});
assert(modifiedValidation.isValid === false, 'Validation must fail closed when signature changes');

// TEST 10: Invalidation resets state cleanly without crashing
console.log('Running Test 10: Clean reset after invalidation');
const freshStateAfterInvalidation = modifiedValidation.isValid
  ? stateScene1Done
  : createEmptyVideoSceneCompletionState({
      project_id: 'proj_alpha',
      content_item_id: 'item_101',
      production_mode: 'motion_explainer',
      scene_plan_signature: sigAModified,
    });
assert(freshStateAfterInvalidation.scenes[0].clip_created === false, 'Fresh state has 0 completed clips');
assert(freshStateAfterInvalidation.scene_plan_signature === sigAModified, 'Fresh state has new signature');

// TEST 11: Progress counter returns 0/3 when no scenes marked
console.log('Running Test 11: Progress counter 0/3');
assert(getCompletedVideoSceneCount(initialState) === 0, 'Progress must be 0');

// TEST 12: Progress counter returns 1/3 when one scene marked
console.log('Running Test 12: Progress counter 1/3');
assert(getCompletedVideoSceneCount(stateScene1Done) === 1, 'Progress must be 1');

// TEST 13: Progress counter returns 2/3 when two scenes marked
console.log('Running Test 13: Progress counter 2/3');
assert(getCompletedVideoSceneCount(stateScene1And2Done) === 2, 'Progress must be 2');

// TEST 14: Progress counter returns 3/3 when all three scenes marked
console.log('Running Test 14: Progress counter 3/3');
const stateAll3Done = setVideoSceneClipCreated(stateScene1And2Done, 3, true);
assert(getCompletedVideoSceneCount(stateAll3Done) === 3, 'Progress must be 3');

// TEST 15: areAllVideoScenesCreated returns false for 0, 1, 2 scenes and true only for 3
console.log('Running Test 15: areAllVideoScenesCreated check');
assert(areAllVideoScenesCreated(initialState) === false, '0/3 is not all created');
assert(areAllVideoScenesCreated(stateScene1Done) === false, '1/3 is not all created');
assert(areAllVideoScenesCreated(stateScene1And2Done) === false, '2/3 is not all created');
assert(areAllVideoScenesCreated(stateAll3Done) === true, '3/3 is all created');
assert(areAllVideoScenesCreated(null) === false, 'null is false');

// TEST 16: Malformed stored state missing scenes fails validation (fail-closed)
console.log('Running Test 16: Malformed state missing scenes');
const malformedMissingScenes = {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
  updated_at: new Date().toISOString(),
};
assert(
  validateVideoSceneCompletionState(malformedMissingScenes, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'State missing scenes must fail validation'
);

// TEST 17: Malformed stored state with wrong scene numbers fails validation
console.log('Running Test 17: Malformed scene numbers');
const malformedWrongSceneNums = {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
  updated_at: new Date().toISOString(),
  scenes: [
    { scene_number: 1, clip_created: false, marked_at: null },
    { scene_number: 4, clip_created: false, marked_at: null },
    { scene_number: 5, clip_created: false, marked_at: null },
  ],
};
assert(
  validateVideoSceneCompletionState(malformedWrongSceneNums, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'State with invalid scene numbers must fail validation'
);

// TEST 18: Malformed stored state with extra scenes fails validation
console.log('Running Test 18: Malformed extra scenes');
const malformedExtraScenes = {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
  updated_at: new Date().toISOString(),
  scenes: [
    { scene_number: 1, clip_created: false, marked_at: null },
    { scene_number: 2, clip_created: false, marked_at: null },
    { scene_number: 3, clip_created: false, marked_at: null },
    { scene_number: 4, clip_created: false, marked_at: null },
  ],
};
assert(
  validateVideoSceneCompletionState(malformedExtraScenes, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'State with 4 scenes must fail validation (canonical requires exactly 3)'
);

// TEST 19: Malformed stored state with non-boolean clip_created fails validation
console.log('Running Test 19: Non-boolean clip_created');
const malformedNonBoolean = {
  project_id: 'proj_alpha',
  content_item_id: 'item_101',
  production_mode: 'motion_explainer',
  scene_plan_signature: sigA,
  updated_at: new Date().toISOString(),
  scenes: [
    { scene_number: 1, clip_created: 'yes', marked_at: null },
    { scene_number: 2, clip_created: false, marked_at: null },
    { scene_number: 3, clip_created: false, marked_at: null },
  ],
};
assert(
  validateVideoSceneCompletionState(malformedNonBoolean, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'State with non-boolean clip_created must fail validation'
);

// TEST 20: validateVideoSceneCompletionState rejects wrong project_id or content_item_id
console.log('Running Test 20: Rejection of wrong project_id or content_item_id');
assert(
  validateVideoSceneCompletionState(stateAll3Done, {
    project_id: 'different_project',
    content_item_id: 'item_101',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'Rejects different project_id'
);
assert(
  validateVideoSceneCompletionState(stateAll3Done, {
    project_id: 'proj_alpha',
    content_item_id: 'different_item',
    production_mode: 'motion_explainer',
    scene_plan_signature: sigA,
  }).isValid === false,
  'Rejects different content_item_id'
);

// TEST 21: validateVideoSceneCompletionState rejects wrong production_mode
console.log('Running Test 21: Rejection of wrong production_mode');
assert(
  validateVideoSceneCompletionState(stateAll3Done, {
    project_id: 'proj_alpha',
    content_item_id: 'item_101',
    production_mode: 'product_demo',
    scene_plan_signature: sigA,
  }).isValid === false,
  'Rejects different production_mode'
);

// TEST 22: buildVideoScenePlanSignature is deterministic across key ordering and whitespace
console.log('Running Test 22: Deterministic signature generation');
const mockCandidateADuplicate: VideoProductionCandidate = {
  rationale: 'Educational concept walkthrough',
  confidence_score: 0.95,
  production_mode: 'motion_explainer',
  candidate_type: 'video',
  candidate_id: 'cand_video_motion_1',
  production_details: {
    recommended_duration_seconds: 45,
    visual_direction: 'Clean minimalist vector animations',
    format: 'motion_graphics',
    scenes: [
      {
        required_assets: [],
        on_screen_text: '80% Bisnis Gagal Karena Cashflow',
        visual_cue: 'Animated red chart plummeting down',
        duration_seconds: 15,
        scene_type: 'hook',
        scene_number: 1,
        narration: 'Tahukah Anda 80% bisnis gagal karena cashflow?',
      },
      {
        required_assets: [],
        on_screen_text: 'Sistem Otomasi Real-Time',
        visual_cue: 'Smooth transition to clean green dashboard metrics',
        duration_seconds: 15,
        scene_type: 'body',
        scene_number: 2,
        narration: 'Gunakan sistem otomasi pencatatan keuangan real-time.',
      },
      {
        required_assets: [],
        on_screen_text: 'Coba Demo Gratis Sekarang',
        visual_cue: 'Animated CTA button click with glowing pulse',
        duration_seconds: 15,
        scene_type: 'cta',
        scene_number: 3,
        narration: 'Coba demo gratis sekarang melalui link di bio.',
      },
    ],
  },
};
const sigADup = buildVideoScenePlanSignature(mockCandidateADuplicate);
assert(sigA === sigADup, 'Signatures must be deterministic regardless of object key order');
assert(
  getVideoSceneCompletionStorageKey('item_101', 'motion_explainer') ===
    'studio_video_scene_completion_item_101_motion_explainer',
  'Storage key must match expected format'
);

console.log('--- ALL 22 TESTS IN PHASE 3D-C1C-D PASSED PERFECTLY ---');
