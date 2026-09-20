import { CarouselProductionCandidate } from './production-candidate';
import { validateProductionCandidate } from './production-candidate';
import { CharacterDNA } from './content-contract';
import { injectCharacterToPrompt } from './character-prompt';

export interface CanonicalCarouselSlideMetadata {
  slide: number;
  visual_format?: 'photography' | 'infographic' | 'hybrid' | string;
  slide_image_prompt?: string;
}

/**
 * Builds the CURRENT EFFECTIVE CarouselProductionCandidate.
 *
 * Ensures that if CharacterDNA is active, the candidate's final_prompts
 * match the exact character-injected prompts shown to and copied by the user
 * in the CarouselPanel workspace.
 *
 * If no CharacterDNA is selected, returns the candidate with base prompts unaltered.
 * Fails closed (returns null) if inputs are invalid or validation fails.
 */
export function buildEffectiveCarouselProductionCandidate(
  baseCandidate: CarouselProductionCandidate,
  canonicalSlidesOrDNA?: CanonicalCarouselSlideMetadata[] | CharacterDNA | null,
  maybeCharacterDNA?: CharacterDNA | null
): CarouselProductionCandidate | null {
  if (!baseCandidate || typeof baseCandidate !== 'object') {
    return null;
  }

  // 1. Validate base candidate
  const baseValidation = validateProductionCandidate(baseCandidate);
  if (!baseValidation.isValid) {
    return null;
  }

  // 2. Require candidate_type === 'carousel'
  if (baseCandidate.candidate_type !== 'carousel') {
    return null;
  }

  if (
    !baseCandidate.production_details ||
    !Array.isArray(baseCandidate.production_details.slides) ||
    !baseCandidate.final_prompts ||
    !Array.isArray(baseCandidate.final_prompts.slides)
  ) {
    return null;
  }

  let canonicalSlides: CanonicalCarouselSlideMetadata[] | null = null;
  let characterDNA: CharacterDNA | null = null;

  if (Array.isArray(canonicalSlidesOrDNA)) {
    canonicalSlides = canonicalSlidesOrDNA;
    characterDNA = maybeCharacterDNA ?? null;
  } else if (
    canonicalSlidesOrDNA &&
    typeof canonicalSlidesOrDNA === 'object' &&
    'identity' in canonicalSlidesOrDNA
  ) {
    characterDNA = canonicalSlidesOrDNA;
    canonicalSlides = null;
  } else {
    characterDNA = maybeCharacterDNA ?? null;
  }

  const slideCount = baseCandidate.production_details.slide_count;
  if (
    typeof slideCount !== 'number' ||
    !Number.isInteger(slideCount) ||
    slideCount <= 0
  ) {
    return null;
  }

  const effectiveCanonicalSlides: CanonicalCarouselSlideMetadata[] =
    canonicalSlides && Array.isArray(canonicalSlides)
      ? canonicalSlides
      : baseCandidate.production_details.slides.map((s) => ({
          slide: s.slide_number,
          visual_format: s.slide_number === 1 ? 'photography' : 'infographic',
        }));

  // 3. Require slide counts to align between candidate details, prompts, and canonical slides
  if (
    baseCandidate.production_details.slides.length !== slideCount ||
    baseCandidate.final_prompts.slides.length !== slideCount ||
    effectiveCanonicalSlides.length !== slideCount
  ) {
    return null;
  }

  // 4. Build transformed slide prompts
  const effectiveSlidePrompts = baseCandidate.final_prompts.slides.map((baseSlidePrompt, index) => {
    const slideNumber = index + 1;
    const matchingCanonicalSlide = effectiveCanonicalSlides.find(
      (s) => s.slide === slideNumber
    );

    const visualFormat =
      matchingCanonicalSlide?.visual_format ||
      (slideNumber === 1 ? 'photography' : 'infographic');

    const effectivePrompt = injectCharacterToPrompt(
      baseSlidePrompt.prompt,
      characterDNA,
      visualFormat
    );

    return {
      slide_number: slideNumber,
      prompt: effectivePrompt,
    };
  });

  // 5. Build a NEW immutable CarouselProductionCandidate
  const effectiveCandidate: CarouselProductionCandidate = {
    candidate_id: baseCandidate.candidate_id,
    candidate_type: 'carousel',
    production_details: {
      objective: baseCandidate.production_details.objective,
      slide_count: baseCandidate.production_details.slide_count,
      cover_direction: baseCandidate.production_details.cover_direction,
      slides: baseCandidate.production_details.slides.map((s) => ({
        slide_number: s.slide_number,
        role: s.role,
        headline: s.headline,
        body: s.body,
        visual_direction: s.visual_direction,
        layout_direction: s.layout_direction,
      })),
      visual_continuity: baseCandidate.production_details.visual_continuity,
      branding: baseCandidate.production_details.branding,
      negative_constraints: baseCandidate.production_details.negative_constraints,
    },
    final_prompts: {
      master_prompt: baseCandidate.final_prompts.master_prompt,
      slides: effectiveSlidePrompts,
    },
  };

  // 9. Validate final effective candidate
  const effectiveValidation = validateProductionCandidate(effectiveCandidate);
  if (!effectiveValidation.isValid) {
    return null;
  }

  return effectiveCandidate;
}

/**
 * Pure synchronous deterministic 32-bit FNV-1a hash formatted as an 8-character hex string.
 */
function hashDeterministicString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Builds a deterministic plan signature for CarouselProductionCandidate.
 *
 * It must:
 * - validate candidate strictly
 * - require candidate_type === 'carousel'
 * - include all production-relevant carousel data (objective, slides, visual continuity, final_prompts)
 * - naturally change when CharacterDNA changes effective prompts
 * - exclude timestamps and random state
 * - return compact 'carousel_sig_<8-char-hash>'
 *
 * Returns empty string '' if candidate is invalid.
 */
export function buildCarouselProductionPlanSignature(
  candidate: CarouselProductionCandidate | null | undefined
): string {
  if (!candidate || typeof candidate !== 'object') {
    return '';
  }

  const validation = validateProductionCandidate(candidate);
  if (!validation.isValid || candidate.candidate_type !== 'carousel') {
    return '';
  }

  if (
    !candidate.production_details ||
    !Array.isArray(candidate.production_details.slides) ||
    !candidate.final_prompts ||
    !Array.isArray(candidate.final_prompts.slides)
  ) {
    return '';
  }

  const canonicalPayload = {
    candidate_id: candidate.candidate_id,
    slide_count: candidate.production_details.slide_count,
    objective: candidate.production_details.objective,
    cover_direction: candidate.production_details.cover_direction,
    visual_continuity: candidate.production_details.visual_continuity,
    branding: candidate.production_details.branding,
    negative_constraints: candidate.production_details.negative_constraints,
    slides: candidate.production_details.slides.map((s) => ({
      slide_number: s.slide_number,
      role: s.role,
      headline: s.headline,
      body: s.body,
      visual_direction: s.visual_direction,
      layout_direction: s.layout_direction,
    })),
    master_prompt: candidate.final_prompts.master_prompt,
    final_slide_prompts: candidate.final_prompts.slides.map((p) => ({
      slide_number: p.slide_number,
      prompt: p.prompt,
    })),
  };

  const serialized = JSON.stringify(canonicalPayload);
  const hash = hashDeterministicString(serialized);
  return `carousel_sig_${hash}`;
}
