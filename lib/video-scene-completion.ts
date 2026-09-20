import { VideoProductionMode, VideoSceneProductionPlan } from './production-contract';
import { VideoProductionCandidate } from './production-candidate';

// ============================================================================
// PHASE 3D-C1C-D: REAL SCENE COMPLETION CONTRACT
// Vendor-neutral, manual user confirmation contract for external video clips.
// Strictly isolated from copiedStates, prompt generation, and production gate.
// ============================================================================

export interface VideoSceneCompletionEntry {
  scene_number: 1 | 2 | 3;
  clip_created: boolean;
  marked_at: string | null;
}

export interface VideoSceneCompletionState {
  project_id: string;
  content_item_id: string;
  production_mode: VideoProductionMode;
  scene_plan_signature: string;
  scenes: [
    VideoSceneCompletionEntry,
    VideoSceneCompletionEntry,
    VideoSceneCompletionEntry
  ];
  updated_at: string;
}

export interface VideoSceneCompletionValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Storage key helper for project-scoped scene completion persistence.
 */
export function getVideoSceneCompletionStorageKey(
  content_item_id: string,
  production_mode: VideoProductionMode
): string {
  return `studio_video_scene_completion_${content_item_id}_${production_mode}`;
}

/**
 * Builds a deterministic pure signature from canonical candidate scene plan.
 * Used exclusively to detect scene plan changes and invalidate stale completion.
 * Does NOT contain timestamps, random values, or copiedStates.
 */
export function buildVideoScenePlanSignature(
  candidate: VideoProductionCandidate | null | undefined
): string {
  if (!candidate || typeof candidate !== 'object') return '';
  if (candidate.candidate_type !== 'video') return '';

  const details = candidate.production_details;
  if (!details || typeof details !== 'object') return '';

  const mode = details.production_mode;
  const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
  if (!mode || !validModes.includes(mode)) return '';

  const scenes = details.scenes;
  if (!Array.isArray(scenes) || scenes.length !== 3) return '';

  const normalizedSceneStrings: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene: VideoSceneProductionPlan = scenes[i];
    if (!scene || typeof scene !== 'object') return '';

    const expectedNum = (i + 1) as 1 | 2 | 3;
    if (scene.scene_number !== expectedNum) return '';
    if (typeof scene.duration_seconds !== 'number' || scene.duration_seconds <= 0) return '';
    if (typeof scene.purpose !== 'string') return '';
    if (typeof scene.visual_direction !== 'string') return '';
    if (typeof scene.action !== 'string') return '';
    if (typeof scene.camera !== 'string') return '';
    if (typeof scene.voiceover !== 'string') return '';
    if (typeof scene.on_screen_text !== 'string') return '';
    if (typeof scene.scene_type !== 'string') return '';
    if (!Array.isArray(scene.required_assets)) return '';

    const requiredAssets = [...scene.required_assets].sort().join(',');

    normalizedSceneStrings.push(
      [
        `num:${scene.scene_number}`,
        `dur:${scene.duration_seconds}`,
        `type:${scene.scene_type}`,
        `purpose:${scene.purpose}`,
        `visual:${scene.visual_direction}`,
        `act:${scene.action}`,
        `cam:${scene.camera}`,
        `vo:${scene.voiceover}`,
        `text:${scene.on_screen_text}`,
        `assets:${requiredAssets}`,
      ].join('|')
    );
  }

  return `sig_${mode}_${normalizedSceneStrings.join('##')}`;
}

/**
 * Creates a fresh empty completion state for 3 canonical scenes.
 */
export function createEmptyVideoSceneCompletionState(params: {
  project_id: string;
  content_item_id: string;
  production_mode: VideoProductionMode;
  scene_plan_signature: string;
}): VideoSceneCompletionState {
  return {
    project_id: params.project_id,
    content_item_id: params.content_item_id,
    production_mode: params.production_mode,
    scene_plan_signature: params.scene_plan_signature,
    scenes: [
      { scene_number: 1, clip_created: false, marked_at: null },
      { scene_number: 2, clip_created: false, marked_at: null },
      { scene_number: 3, clip_created: false, marked_at: null },
    ],
    updated_at: new Date().toISOString(),
  };
}

/**
 * Validates persisted VideoSceneCompletionState against expected project, item, mode, and signature.
 * Fails closed on any corruption, missing scenes, duplicate scene numbers, or signature mismatch.
 */
export function validateVideoSceneCompletionState(
  state: unknown,
  expected: {
    project_id: string;
    content_item_id: string;
    production_mode: VideoProductionMode;
    scene_plan_signature: string;
  }
): VideoSceneCompletionValidationResult {
  if (!state || typeof state !== 'object') {
    return { isValid: false, error: 'Completion state is null or non-object' };
  }

  const typed = state as Partial<VideoSceneCompletionState>;

  if (typeof typed.updated_at !== 'string' || typed.updated_at.trim().length === 0) {
    return {
      isValid: false,
      error: 'updated_at must be a non-empty string',
    };
  }

  if (typed.project_id !== expected.project_id) {
    return {
      isValid: false,
      error: `Project ID mismatch: expected "${expected.project_id}", found "${typed.project_id}"`,
    };
  }

  if (typed.content_item_id !== expected.content_item_id) {
    return {
      isValid: false,
      error: `Content Item ID mismatch: expected "${expected.content_item_id}", found "${typed.content_item_id}"`,
    };
  }

  const validModes: VideoProductionMode[] = ['human_led', 'product_demo', 'motion_explainer'];
  if (!typed.production_mode || !validModes.includes(typed.production_mode)) {
    return {
      isValid: false,
      error: `Invalid production_mode in completion state: "${typed.production_mode}"`,
    };
  }

  if (typed.production_mode !== expected.production_mode) {
    return {
      isValid: false,
      error: `Mode mismatch: expected "${expected.production_mode}", found "${typed.production_mode}"`,
    };
  }

  if (!typed.scene_plan_signature || typed.scene_plan_signature !== expected.scene_plan_signature) {
    return {
      isValid: false,
      error: `Scene plan signature mismatch or missing: expected "${expected.scene_plan_signature}", found "${typed.scene_plan_signature}"`,
    };
  }

  if (!Array.isArray(typed.scenes) || typed.scenes.length !== 3) {
    return {
      isValid: false,
      error: `Scenes array must contain exactly 3 entries, found ${Array.isArray(typed.scenes) ? typed.scenes.length : 0}`,
    };
  }

  const seenSceneNumbers = new Set<number>();
  for (let i = 0; i < typed.scenes.length; i++) {
    const scene = typed.scenes[i];
    if (!scene || typeof scene !== 'object') {
      return { isValid: false, error: `Scene entry at index ${i} is invalid` };
    }

    const expectedNum = (i + 1) as 1 | 2 | 3;
    if (scene.scene_number !== expectedNum) {
      return {
        isValid: false,
        error: `Scene entry at index ${i} has scene_number ${scene.scene_number}, expected ${expectedNum}`,
      };
    }

    if (seenSceneNumbers.has(scene.scene_number)) {
      return {
        isValid: false,
        error: `Duplicate scene_number ${scene.scene_number} detected`,
      };
    }
    seenSceneNumbers.add(scene.scene_number);

    if (typeof scene.clip_created !== 'boolean') {
      return {
        isValid: false,
        error: `Scene ${scene.scene_number} clip_created must be boolean`,
      };
    }

    if (scene.clip_created === true) {
      if (typeof scene.marked_at !== 'string' || scene.marked_at.trim().length === 0) {
        return {
          isValid: false,
          error: `Scene ${scene.scene_number} is marked created but marked_at is not a non-empty string`,
        };
      }
    } else {
      if (scene.marked_at !== null) {
        return {
          isValid: false,
          error: `Scene ${scene.scene_number} clip_created is false so marked_at MUST be strictly null`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Pure helper to set clip_created on a specific scene number.
 */
export function setVideoSceneClipCreated(
  state: VideoSceneCompletionState,
  sceneNumber: 1 | 2 | 3,
  clipCreated: boolean,
  timestamp?: string
): VideoSceneCompletionState {
  const updatedScenes = state.scenes.map((s) => {
    if (s.scene_number === sceneNumber) {
      return {
        ...s,
        clip_created: clipCreated,
        marked_at: clipCreated ? (timestamp || new Date().toISOString()) : null,
      };
    }
    return s;
  }) as [VideoSceneCompletionEntry, VideoSceneCompletionEntry, VideoSceneCompletionEntry];

  return {
    ...state,
    scenes: updatedScenes,
    updated_at: timestamp || new Date().toISOString(),
  };
}

/**
 * Returns number of completed scenes (0 to 3).
 */
export function getCompletedVideoSceneCount(
  state: VideoSceneCompletionState | null | undefined
): number {
  if (!state || !Array.isArray(state.scenes)) return 0;
  return state.scenes.filter((s) => s && s.clip_created === true).length;
}

/**
 * Returns true only if all 3 canonical scenes have clip_created === true.
 */
export function areAllVideoScenesCreated(
  state: VideoSceneCompletionState | null | undefined
): boolean {
  if (!state || !Array.isArray(state.scenes) || state.scenes.length !== 3) {
    return false;
  }
  return state.scenes.every((s) => s && s.clip_created === true);
}
