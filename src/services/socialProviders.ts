import type { SocialPlatform } from '@/types/social';

export interface SocialSyncPayload {
  contaId?: string;
}

export interface SocialSyncResult {
  success: boolean;
  message: string;
  syncedAt: string;
  generatedProfile: {
    platform: SocialPlatform;
    expectedPostMix: Array<{ type: 'feed' | 'reels' | 'video' | 'artigo' | 'carousel'; ratio: number }>;
    growthBand: { min: number; max: number };
    engagementBand: { min: number; max: number };
  };
}

const scenarioByPlatform = {
  instagram_business: {
    expectedPostMix: [
      { type: 'reels', ratio: 0.45 },
      { type: 'feed', ratio: 0.3 },
      { type: 'carousel', ratio: 0.2 },
      { type: 'video', ratio: 0.05 },
    ],
    growthBand: { min: 18, max: 65 },
    engagementBand: { min: 3.1, max: 8.6 },
  },
  linkedin_page: {
    expectedPostMix: [
      { type: 'artigo', ratio: 0.35 },
      { type: 'feed', ratio: 0.35 },
      { type: 'video', ratio: 0.2 },
      { type: 'carousel', ratio: 0.1 },
    ],
    growthBand: { min: 6, max: 25 },
    engagementBand: { min: 1.2, max: 4.3 },
  },
} as const;

export interface SocialProvider {
  platform: SocialPlatform;
  syncInsights: (payload: SocialSyncPayload) => Promise<SocialSyncResult>;
}

class MockSocialProvider implements SocialProvider {
  constructor(public platform: SocialPlatform) {}

  async syncInsights(): Promise<SocialSyncResult> {
    const scenario = scenarioByPlatform[this.platform];

    return {
      success: true,
      message: `Sincronização mock concluída para ${this.platform} com cenário de homologação realista.`,
      syncedAt: new Date().toISOString(),
      generatedProfile: {
        platform: this.platform,
        expectedPostMix: [...scenario.expectedPostMix],
        growthBand: scenario.growthBand,
        engagementBand: scenario.engagementBand,
      },
    };
  }
}

export function getSocialProvider(platform: SocialPlatform): SocialProvider {
  return new MockSocialProvider(platform);
}
