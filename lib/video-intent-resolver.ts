import { ContentItem, SharedContentContext } from './content-contract';
import { FunnelStrategy, FunnelStage, normalizeFunnelStage, parseStrictFunnelStage } from './funnel-strategy';
import { VideoProductionMode } from './production-contract';
import { ProductionEngineContext } from './production-engine-context';

export interface VideoIntentDecision {
  recommended_mode: VideoProductionMode;
  recommendation_reason: string;
  required_inputs: string[];
  optional_inputs: string[];
}

export function getVideoProductionModeLabel(mode: VideoProductionMode): string {
  switch (mode) {
    case 'human_led':
      return 'Video dengan Talent';
    case 'product_demo':
      return 'Demo Produk / Aplikasi';
    case 'motion_explainer':
      return 'Video Penjelasan Visual';
  }
}

export function getVideoProductionModeDescription(mode: VideoProductionMode): string {
  switch (mode) {
    case 'human_led':
      return 'Talent menjelaskan pesan langsung ke audiens. Cocok untuk trust, edukasi, dan komunikasi personal.';
    case 'product_demo':
      return 'Menunjukkan produk, aplikasi, fitur, atau workflow secara langsung.';
    case 'motion_explainer':
      return 'Menjelaskan konsep, langkah, framework, data, atau checklist melalui visual dan motion.';
  }
}

/**
 * Resolves video production mode recommendation deterministically from authoritative context.
 *
 * Precedence:
 * 1. ContentItem explicit demonstration intent (e.g. demo, walkthrough, lihat cara/fitur bekerja) -> product_demo
 * 2. ContentItem structured framework/process/steps/list signals -> motion_explainer
 * 3. ContentItem empathy/objection/relatable problem/perspective signals -> human_led
 * 4. Funnel stage modifier (TOFU favors human_led, MOFU favors motion_explainer/demo, BOFU favors demo/objection-led human)
 * 5. General fallback -> human_led
 *
 * NOTE: Generic business context keywords (aplikasi, software, produk, website) alone NEVER trigger product_demo.
 */
export function resolveVideoIntent(
  input:
    | ProductionEngineContext
    | {
        contentItem: ContentItem;
        sharedContext: SharedContentContext;
        funnelStrategy: FunnelStrategy;
        canonical_funnel_stage?: FunnelStage;
      }
): VideoIntentDecision {
  if (!input) {
    return {
      recommended_mode: 'human_led',
      recommendation_reason: 'Konten ini lebih efektif disampaikan langsung oleh talent secara personal karena tidak terdapat intent demonstrasi produk maupun alur diagram visual khusus.',
      required_inputs: ['character'],
      optional_inputs: ['b_roll_visual']
    };
  }

  // Extract authoritative components
  const contentItem: ContentItem | undefined =
    'content_item' in input ? input.content_item : input.contentItem;
  const sharedContext: SharedContentContext | undefined =
    'shared_context' in input ? input.shared_context : input.sharedContext;
  const funnelStrategy: FunnelStrategy | undefined =
    'funnel_strategy' in input ? input.funnel_strategy : input.funnelStrategy;

  if (!contentItem) {
    return {
      recommended_mode: 'human_led',
      recommendation_reason: 'Konten ini lebih efektif disampaikan langsung oleh talent secara personal karena tidak terdapat intent demonstrasi produk maupun alur diagram visual khusus.',
      required_inputs: ['character'],
      optional_inputs: ['b_roll_visual']
    };
  }

  // Determine funnel stage
  let stage: FunnelStage | null = null;
  if ('canonical_funnel_stage' in input && input.canonical_funnel_stage) {
    stage = input.canonical_funnel_stage;
  } else if (contentItem.jenis) {
    stage = parseStrictFunnelStage(contentItem.jenis) || normalizeFunnelStage(contentItem.jenis);
  }

  // Extract Content Item textual fields (Primary authoritative source)
  const itemHeadline = (contentItem.headline || '').toLowerCase();
  const itemTujuan = (contentItem.tujuan || '').toLowerCase();
  const itemBody = (contentItem.body || '').toLowerCase();
  const itemVisual = (contentItem.visual || '').toLowerCase();
  const itemKeterangan = (contentItem.keterangan || '').toLowerCase();
  const itemCta = (contentItem.cta || '').toLowerCase();
  const itemFormat = (contentItem.format || '').toLowerCase();
  const itemAssetReason = (contentItem.assetTypeReason || '').toLowerCase();
  const itemPrimaryAsset = (contentItem.primaryAssetType || '').toLowerCase();

  const itemPrimaryText = `${itemHeadline} ${itemTujuan} ${itemBody} ${itemVisual} ${itemKeterangan} ${itemCta} ${itemFormat} ${itemAssetReason} ${itemPrimaryAsset}`;

  let productDemoScore = 0;
  let motionExplainerScore = 0;
  let humanLedScore = 0;

  // 1. EVALUATE PRODUCT DEMO (Strict demonstration intent required)
  // Strong demonstration patterns
  const demoActionPatterns = [
    /\b(demo|demonstrasi|walkthrough|screen recording|rekaman layar)\b/i,
    /(lihat|tunjukkan|tampilkan|uji|preview|coba|bedah)\s+(fitur|dashboard|alur|cara kerja|antarmuka|layar|tools|aplikasi|produk|workflow|proses)/i,
    /(cara|langkah)\s+(menggunakan|memakai|menjalankan|mengoperasikan)\s+(fitur|dashboard|aplikasi|tools|produk|software)/i,
    /(lihat|tonton)\s+bagaimana\s+.+\s+(digunakan|bekerja|dijalankan|beroperasi)/i,
    /(fitur|dashboard|sistem)\s+.+\s+(bekerja|beroperasi)\s+(sebelum|secara langsung|nyata)/i,
    /(klik tombol|tampilan aplikasi|workflow aplikasi|uji fitur|preview fitur|interaksi fitur|before \/? after penggunaan produk)/i,
    /(screen|tampilan|interface|ui)\s+(aplikasi|software|dashboard|produk)/i,
  ];

  for (const pattern of demoActionPatterns) {
    if (pattern.test(itemPrimaryText)) {
      productDemoScore += 8;
      break;
    }
  }

  // Supporting visual / metadata cues for demonstration
  if (/\b(rekaman layar|screen recording|screencast|walkthrough ui|tangkapan layar)\b/i.test(itemVisual + ' ' + itemAssetReason)) {
    productDemoScore += 3;
  }

  // 2. EVALUATE MOTION EXPLAINER (Framework / Steps / Comparison / Diagram)
  const motionPatterns = [
    /\b(framework|diagram|checklist|matriks|matrix|formula|infografis|grafik|timeline|breakdown|klasifikasi|peta|mindset)\b/i,
    /\b(\d+|tiga|lima|empat|tujuh|sepuluh)\s+(langkah|tahap|step|alur|cara|kesalahan|poin|pilar|tips|strategi|prinsip|kategori|rumus)\b/i,
    /\b(langkah-langkah|tahapan|alur kerja|perbandingan|komparasi|vs|versus|struktur|anatomi|fondasi|pola|perbedaan)\b/i,
    /(bagaimana|cara)\s+(membuat|membangun|menyusun|merancang)\s+(funnel|sistem|alur|struktur|framework|strategi)/i,
    /(3|5|4|7|\d+)\s+kesalahan\s+(pemula|umum|fatal|saat)/i,
  ];

  for (const pattern of motionPatterns) {
    if (pattern.test(itemPrimaryText)) {
      motionExplainerScore += 8;
      break;
    }
  }

  // Supporting visual cues for motion / diagram
  if (/\b(diagram|alur visual|infografis|grafik|animasi teks|pilar fondasi|chart)\b/i.test(itemVisual + ' ' + itemAssetReason)) {
    motionExplainerScore += 3;
  }

  // 3. EVALUATE HUMAN-LED (Empathy / Opinion / Perspective / Relatable Problem / Trust / Objection)
  const humanPatterns = [
    /\b(kenapa|mengapa|alasan|rahasia|curhat|opini|perspektif|sudut pandang|jujur|cerita|kisah|pengalaman)\b/i,
    /\b(takut|ketakutan|khawatir|bingung|ragu|keraguan|objection|hambatan mental|trauma|frustrasi|gagal)\b/i,
    /\b(apakah|beneran|benar-benar|mitos|myth|misconception|fakta vs mitos|realita)\b/i,
    /\b(pemula|kreator|solopreneur|pebisnis)\s+(takut|ragu|bingung|merasa|berpikir)\b/i,
    /\b(trust|kepercayaan|relatable|koneksi|cerita pribadi|pengalaman nyata|pengalaman pribadi|blak-blakan)\b/i,
    /(bicara|bicara langsung|ngobrol|monolog|tatap kamera|wajah|ekspresi|interaksi personal)/i,
  ];

  for (const pattern of humanPatterns) {
    if (pattern.test(itemPrimaryText)) {
      humanLedScore += 8;
      break;
    }
  }

  // 4. FUNNEL STRATEGY MODIFIER
  if (stage === 'TOFU') {
    humanLedScore += 1.5;
    motionExplainerScore += 0.5;
  } else if (stage === 'MOFU') {
    motionExplainerScore += 1.5;
    if (productDemoScore > 0) {
      productDemoScore += 0.5;
    }
  } else if (stage === 'BOFU') {
    if (productDemoScore > 0) {
      productDemoScore += 1.5;
    } else if (humanLedScore > 0) {
      humanLedScore += 1.5;
    }
  }

  // 5. DETERMINISTIC DECISION & REASONING
  if (productDemoScore > motionExplainerScore && productDemoScore > humanLedScore) {
    return {
      recommended_mode: 'product_demo',
      recommendation_reason: 'Konten berfokus pada demonstrasi dan alur penggunaan fitur secara nyata, sehingga paling efektif ditampilkan melalui demo produk/aplikasi.',
      required_inputs: ['product_screenshot'],
      optional_inputs: ['logo', 'screen_recording']
    };
  }

  if (motionExplainerScore > productDemoScore && motionExplainerScore >= humanLedScore) {
    return {
      recommended_mode: 'motion_explainer',
      recommendation_reason: 'Konten berfokus pada langkah, framework, atau perbandingan terstruktur, sehingga lebih jelas dipahami melalui visual diagram dan motion explainer.',
      required_inputs: [],
      optional_inputs: ['brand_visual']
    };
  }

  if (humanLedScore > 0) {
    return {
      recommended_mode: 'human_led',
      recommendation_reason: 'Konten membahas masalah audiens, opini, atau objection secara langsung, sehingga lebih efektif disampaikan oleh talent untuk membangun kedekatan dan kepercayaan.',
      required_inputs: ['character'],
      optional_inputs: ['b_roll_visual']
    };
  }

  // Default fallback
  return {
    recommended_mode: 'human_led',
    recommendation_reason: 'Konten ini lebih efektif disampaikan langsung oleh talent secara personal karena tidak terdapat intent demonstrasi produk maupun alur diagram visual khusus.',
    required_inputs: ['character'],
    optional_inputs: ['b_roll_visual']
  };
}
