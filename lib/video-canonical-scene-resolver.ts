import {
  VideoProductionCandidate,
  VideoSceneProductionPlan,
  VideoProductionMode,
  validateProductionCandidate,
} from './production-candidate';
import { ProductAssetContext } from './video-production-input';

export interface CanonicalSceneResolveParams {
  candidates: any[] | null | undefined;
  selectedMode: VideoProductionMode | string | null | undefined;
}

const VALID_VIDEO_MODES: readonly VideoProductionMode[] = [
  'human_led',
  'product_demo',
  'motion_explainer',
];

const VALID_SCENE_TYPES = new Set([
  'talking_head',
  'product_screen',
  'graphic_motion',
  'b_roll',
  'end_card',
]);

/**
 * Strictly resolves the canonical VideoProductionCandidate matching the selected mode.
 * 
 * FAILS CLOSED (returns null) if:
 * - candidates list is null, undefined, not an array, or empty
 * - selectedMode is invalid or not in ['human_led', 'product_demo', 'motion_explainer']
 * - duplicate candidate modes exist in the candidates list
 * - candidate fails canonical schema validation
 * - scenes array does not contain exactly 3 scenes
 * - scene numbers are not strictly 1, 2, 3 without gaps or duplicates
 * - any scene has missing/invalid required fields (duration, purpose, visual_direction, action, camera, scene_type, required_assets)
 * - no candidate matches selectedMode (strictly NO fallback to candidate[0] or human_led)
 */
export function resolveSelectedVideoProductionCandidate(
  params: CanonicalSceneResolveParams
): VideoProductionCandidate | null {
  const { candidates, selectedMode } = params;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  if (
    !selectedMode ||
    typeof selectedMode !== 'string' ||
    !VALID_VIDEO_MODES.includes(selectedMode as VideoProductionMode)
  ) {
    return null;
  }

  const normalizedMode = selectedMode as VideoProductionMode;
  const seenModes = new Set<VideoProductionMode>();
  let matchingCandidate: VideoProductionCandidate | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const raw = candidates[i];
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    // Extract VideoProductionCandidate either directly or from style.productionCandidate
    let candidateObj: any = raw;
    if (raw.candidate_type !== 'video' && raw.productionCandidate && typeof raw.productionCandidate === 'object') {
      candidateObj = raw.productionCandidate;
    }

    // If candidateObj is still not a candidate with production_details, fail closed
    if (!candidateObj || candidateObj.candidate_type !== 'video' || !candidateObj.production_details) {
      return null;
    }

    // Strict candidate schema validation
    const validation = validateProductionCandidate(candidateObj);
    if (!validation.isValid) {
      return null;
    }

    const cand = candidateObj as VideoProductionCandidate;
    const candMode = cand.production_details.production_mode;

    if (!candMode || !VALID_VIDEO_MODES.includes(candMode)) {
      return null;
    }

    // Check duplicate candidate modes in the list
    if (seenModes.has(candMode)) {
      return null; // Duplicate mode detected -> fail closed
    }
    seenModes.add(candMode);

    // Validate scenes strictly: exactly 3 scenes with scene_number 1, 2, 3
    const scenes = cand.production_details.scenes;
    if (!Array.isArray(scenes) || scenes.length !== 3) {
      return null;
    }

    const seenSceneNumbers = new Set<number>();
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const scene = scenes[sIdx];
      if (!scene || typeof scene !== 'object') {
        return null;
      }

      const expectedSceneNumber = sIdx + 1;
      if (scene.scene_number !== expectedSceneNumber) {
        return null;
      }

      if (seenSceneNumbers.has(scene.scene_number)) {
        return null;
      }
      seenSceneNumbers.add(scene.scene_number);

      if (
        typeof scene.duration_seconds !== 'number' ||
        !Number.isFinite(scene.duration_seconds) ||
        scene.duration_seconds <= 0
      ) {
        return null;
      }

      if (typeof scene.purpose !== 'string' || typeof scene.visual_direction !== 'string') {
        return null;
      }

      if (typeof scene.action !== 'string' || typeof scene.camera !== 'string') {
        return null;
      }

      if (typeof scene.voiceover !== 'string' || typeof scene.on_screen_text !== 'string') {
        return null;
      }

      if (typeof scene.scene_type !== 'string' || !VALID_SCENE_TYPES.has(scene.scene_type)) {
        return null;
      }

      if (!Array.isArray(scene.required_assets)) {
        return null;
      }

      for (const asset of scene.required_assets) {
        if (typeof asset !== 'string' || asset.trim().length === 0) {
          return null;
        }
      }
    }

    if (candMode === normalizedMode) {
      matchingCandidate = cand;
    }
  }

  // Exact matching candidate must be found, strictly NO fallback to candidate[0]
  return matchingCandidate;
}

/**
 * Maps technical canonical scene_type tokens to human-readable Indonesian UI labels.
 */
export function getSceneTypeLabel(sceneType: string): string {
  switch (sceneType) {
    case 'talking_head':
      return 'Talent / Talking Head';
    case 'product_screen':
      return 'Tampilan Produk';
    case 'graphic_motion':
      return 'Motion Graphic';
    case 'b_roll':
      return 'B-Roll';
    case 'end_card':
      return 'End Card';
    default:
      return sceneType || '—';
  }
}

/**
 * Maps technical required asset tokens to readable labels.
 */
export function getRequiredAssetLabel(assetToken: string): string {
  switch (assetToken) {
    case 'character':
      return 'Karakter Talent (CharacterDNA)';
    case 'product_screenshot':
      return 'Tangkapan Layar Produk';
    case 'product_logo':
      return 'Logo Produk (Opsional)';
    case 'motion_graphic':
      return 'Grafik Animasi';
    case 'brand_visual':
      return 'Visual Brand';
    case 'end_card_graphic':
      return 'Grafik Penutup (End Card)';
    default:
      return assetToken.replace(/_/g, ' ');
  }
}

export interface BuildSceneInstructionsParams {
  scene: VideoSceneProductionPlan;
  productionMode: VideoProductionMode;
  characterDNA?: any | null;
  productAssetContext?: ProductAssetContext | null;
  brandName?: string;
  funnelStage?: string;
}

export interface SceneProductionInstructions {
  imagePrompt: string;
  motionPrompt: string;
  voiceover: string;
  onScreenText: string;
}

/**
 * Pure builder generating production prompts and execution guidance for a canonical scene.
 */
export function buildCanonicalSceneProductionInstructions(
  params: BuildSceneInstructionsParams
): SceneProductionInstructions {
  const { scene, productionMode, characterDNA, productAssetContext, brandName } = params;

  const voiceover = scene.voiceover || '—';
  const onScreenText = scene.on_screen_text || '—';

  let imagePrompt = '';
  let motionPrompt = '';

  if (productionMode === 'human_led') {
    // Human Led: use authoritative CharacterDNA
    const characterSubject =
      characterDNA?.dna_summary_prompt ||
      characterDNA?.locked_visual_prompt ||
      (characterDNA?.identity?.display_name
        ? `Talent Karakter ${characterDNA.identity.display_name}`
        : 'Talent Karakter Konsisten (CharacterDNA)');

    imagePrompt = `Start Frame Image Prompt (Format 9:16 Vertical Portrait):
Subject: ${characterSubject}.
Action: ${scene.action || scene.visual_direction}.
Camera & Framing: ${scene.camera || 'Medium close-up vertikal, eye-level'}.
Environment & Lighting: Studio kerja natural terang, pencahayaan alami lembut, kedalaman ruang sinematik halus.
Composition: Framing vertikal 9:16 rule of thirds, subjek di tengah/kanan frame, ruang negatif lapang di kiri atas untuk teks.
Negative Prompt: distorted anatomy, inconsistent face, extra fingers, cartoon, 3D render, blurry, low resolution, distorted hands, generic stock photo.`;

    motionPrompt = `Video Motion Prompt (Google FX Studio / Veo):
Camera: ${scene.camera || 'Eye-level medium close-up shot'}.
Action & Movement: ${scene.action || scene.visual_direction}.
Visual Direction: ${scene.visual_direction}.
Dialogue Cue: "${scene.voiceover}".
On-Screen Text Cue: "${scene.on_screen_text}".
Duration: ${scene.duration_seconds}s.
Format: 9:16 vertical video.
Negative Prompt: jump cuts, jittery camera, face morphing, flickering background, unnatural motion artifacts.`;
  } else if (productionMode === 'product_demo') {
    // Product Demo: use ProductAssetContext
    const prodName = productAssetContext?.product_name || brandName || 'Aplikasi / Produk';
    const screenshots = productAssetContext?.screenshots || [];
    const screenshotRefText =
      screenshots.length > 0
        ? `Tersedia ${screenshots.length} tangkapan layar produk referensi: ${screenshots
            .map((s, idx) => `[Screenshot ${idx + 1}: ${s.caption || s.storage_path || 'UI View'}]`)
            .join(', ')}.`
        : 'Menggunakan tampilan antarmuka produk UI modern.';

    imagePrompt = `Start Frame Image Prompt (Format 9:16 Vertical Screen UI):
Subject: Tampilan antarmuka kerja dan dasbor fitur untuk produk "${prodName}".
Supporting Assets: ${screenshotRefText}
Action & Focus: ${scene.action || scene.visual_direction}.
Camera & Framing: ${scene.camera || 'Isometric 45-degree angle or flat UI presentation'}.
Visual Style: Modern clean software UI mockup, tipografi tajam dengan kontras tinggi, palet warna elegan.
Negative Prompt: distorted UI, fake unreadable text, broken layout geometry, blurry interface, pixelated graphics, hard selling ads.`;

    motionPrompt = `Video Motion Prompt (Google FX Studio / Veo):
Camera: ${scene.camera || 'Smooth pan and zoom over UI interface'}.
Action & Workflow: ${scene.action || scene.visual_direction}.
UI Direction: ${scene.visual_direction}.
Dialogue Cue: "${scene.voiceover}".
On-Screen Text Cue: "${scene.on_screen_text}".
Duration: ${scene.duration_seconds}s.
Format: 9:16 vertical video.
Negative Prompt: glitchy UI transitions, blurry screen elements, distorted window frames, erratic cursor motion.`;
  } else {
    // Motion Explainer: purely conceptual / typography / diagrammatic
    imagePrompt = `Start Frame Image Prompt (Format 9:16 Vertical Motion Graphic):
Subject: Infografis minimalis, diagram konsep alur, dan kinetic typography.
Key Typography Overlay: "${scene.on_screen_text}".
Visual Concept: ${scene.visual_direction}.
Composition & Framing: ${scene.camera || 'Center card layout vertical 9:16'}.
Color & Lighting: Neutral off-white canvas (#F8F7F4) dengan aksen warna brand berdimensi halus.
Negative Prompt: photorealistic person, complex faces, human hands, messy sketch, stock photo, blurry text, cluttered layout.`;

    motionPrompt = `Video Motion Prompt (Google FX Studio / Veo):
Camera: ${scene.camera || 'Dynamic kinetic motion camera'}.
Motion Direction: ${scene.action || scene.visual_direction}.
Graphic Animation: ${scene.visual_direction}.
On-Screen Typography Cue: "${scene.on_screen_text}".
Voiceover Pacing: "${scene.voiceover}".
Duration: ${scene.duration_seconds}s.
Format: 9:16 vertical video.
Negative Prompt: abrupt cuts, jittery animation, overlapping text layers, unreadable typography, harsh flickering.`;
  }

  return {
    imagePrompt,
    motionPrompt,
    voiceover,
    onScreenText,
  };
}
