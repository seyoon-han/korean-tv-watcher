import { Drama, Episode, StreamSource, SubtitleTrack } from '../types/tv';
import localTranslations from '../assets/title_translations.json';

const BASE_URL = 'https://kisskh.co/api';

let titleMap: Record<string, string> = { ...(localTranslations as Record<string, string>) };

// Sync updated title mapping cache from GitHub raw CDN in background
async function syncRemoteTranslations() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/seyoon-han/korean-tv-watcher/main/src/assets/title_translations.json');
    if (res.ok) {
      const remoteMap = await res.json();
      titleMap = { ...titleMap, ...remoteMap };
    }
  } catch (e) {
    // Keep local fallback
  }
}
syncRemoteTranslations();

function resolveDramaTitles(englishTitle: string): { title: string; koreanTitle?: string } {
  if (!englishTitle) return { title: '' };
  const cleanTitle = englishTitle.replace(/\s*\(\d{4}\)$/, '').trim();
  const korean = titleMap[englishTitle] || titleMap[cleanTitle];
  if (korean && korean !== englishTitle && korean !== cleanTitle) {
    return {
      title: englishTitle,
      koreanTitle: korean
    };
  }
  return { title: englishTitle };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching ${url}`);
  }
  return response.json();
}

export const apiService = {
  // 1. Featured Shows (Hero Carousel)
  async getFeatured(): Promise<Drama[]> {
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/Show`);
      return data.map(item => {
        const { title, koreanTitle } = resolveDramaTitles(item.title);
        return {
          id: item.id,
          title,
          koreanTitle,
          thumbnail: item.thumbnail,
          episodesCount: item.episodesCount,
          score: item.score,
          status: item.status,
          country: item.country,
          description: item.description
        };
      });
    } catch (err) {
      console.error('[API] getFeatured error:', err);
      return [];
    }
  },

  // 2. Recent Updates
  async getRecentUpdates(): Promise<Drama[]> {
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/LastUpdate?ispc=false`);
      return data.map(item => {
        const { title, koreanTitle } = resolveDramaTitles(item.title);
        return {
          id: item.id,
          title,
          koreanTitle,
          thumbnail: item.thumbnail,
          episodesCount: item.episodesCount,
          score: item.score,
          status: item.status,
          country: item.country
        };
      });
    } catch (err) {
      console.error('[API] getRecentUpdates error:', err);
      return [];
    }
  },

  // 3. Trending (Most Search)
  async getTrending(): Promise<Drama[]> {
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/MostSearch?ispc=false`);
      return data.map(item => {
        const { title, koreanTitle } = resolveDramaTitles(item.title);
        return {
          id: item.id,
          title,
          koreanTitle,
          thumbnail: item.thumbnail,
          episodesCount: item.episodesCount,
          score: item.score,
          status: item.status
        };
      });
    } catch (err) {
      console.error('[API] getTrending error:', err);
      return [];
    }
  },

  // 4. Top Rated
  async getTopRated(): Promise<Drama[]> {
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/TopRating?ispc=false`);
      return data.map(item => {
        const { title, koreanTitle } = resolveDramaTitles(item.title);
        return {
          id: item.id,
          title,
          koreanTitle,
          thumbnail: item.thumbnail,
          score: item.score,
          status: item.status
        };
      });
    } catch (err) {
      console.error('[API] getTopRated error:', err);
      return [];
    }
  },

  // 5. Search (Supports both English and Korean search terms)
  async searchDramas(query: string): Promise<Drama[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    let targetQuery = trimmed;

    // Reverse lookup Korean search queries to English titles
    const lowerQ = trimmed.toLowerCase();
    for (const [eng, kor] of Object.entries(titleMap)) {
      if (kor && kor.toLowerCase().includes(lowerQ)) {
        targetQuery = eng;
        break;
      }
    }

    try {
      let data = await fetchJson<any[]>(`${BASE_URL}/DramaList/Search?q=${encodeURIComponent(targetQuery)}`);
      if (!Array.isArray(data) || data.length === 0) {
        if (targetQuery !== trimmed) {
          data = await fetchJson<any[]>(`${BASE_URL}/DramaList/Search?q=${encodeURIComponent(trimmed)}`);
        }
      }

      if (!Array.isArray(data)) return [];

      return data.map(item => {
        const { title, koreanTitle } = resolveDramaTitles(item.title);
        return {
          id: item.id,
          title,
          koreanTitle,
          thumbnail: item.thumbnail,
          episodesCount: item.episodesCount,
          score: item.score,
          status: item.status,
          country: item.country || (targetQuery.toLowerCase().includes('korea') ? 'South Korea' : undefined)
        };
      });
    } catch (err) {
      console.error('[API] searchDramas error:', err);
      return [];
    }
  },

  // 5.1 Category Specific Fetching (Fetches 60+ items using Kisskh List API)
  async getDramasByCategory(cat: string): Promise<Drama[]> {
    try {
      let typeNum = 1; // 1: K-Drama, 2: C-Drama, 3: Anime, 4: Movies
      if (cat === 'kdrama') typeNum = 1;
      else if (cat === 'cdrama') typeNum = 2;
      else if (cat === 'anime') typeNum = 3;
      else if (cat === 'movies') typeNum = 4;

      const [res1, res2] = await Promise.all([
        fetchJson<any>(`${BASE_URL}/DramaList/List?page=1&pageSize=30&type=${typeNum}`),
        fetchJson<any>(`${BASE_URL}/DramaList/List?page=2&pageSize=30&type=${typeNum}`),
      ]);

      const items1 = res1 && Array.isArray(res1.data) ? res1.data : Array.isArray(res1) ? res1 : [];
      const items2 = res2 && Array.isArray(res2.data) ? res2.data : Array.isArray(res2) ? res2 : [];
      const combined = [...items1, ...items2];

      return combined.map(item => {
        const { title, koreanTitle } = resolveDramaTitles(item.title);
        return {
          id: item.id,
          title,
          koreanTitle,
          thumbnail: item.thumbnail,
          episodesCount: item.episodesCount,
          score: item.score,
          status: item.status,
          country: cat === 'kdrama' ? 'South Korea' : cat === 'cdrama' ? 'China' : undefined
        };
      });
    } catch (err) {
      console.error('[API] getDramasByCategory error:', err);
      return [];
    }
  },

  // 6. Drama Detail
  async getDramaDetail(id: number): Promise<Drama | null> {
    try {
      const data = await fetchJson<any>(`${BASE_URL}/DramaList/Drama/${id}?isq=false`);
      const episodes: Episode[] = (data.episodes || []).map((ep: any) => ({
        id: ep.id,
        number: ep.number,
        sub: ep.sub,
        title: ep.title || `Episode ${ep.number}`
      })).sort((a: Episode, b: Episode) => a.number - b.number);

      const { title, koreanTitle } = resolveDramaTitles(data.title);

      return {
        id: data.id,
        title,
        koreanTitle,
        thumbnail: data.thumbnail,
        episodesCount: data.episodesCount || episodes.length,
        score: data.score,
        status: data.status,
        description: data.description,
        country: data.country,
        type: data.type,
        episodes
      };
    } catch (err) {
      console.error('[API] getDramaDetail error:', err);
      return null;
    }
  },

  // 7. Get Episode Video Stream & Subtitles
  async getEpisodeStream(episodeId: number): Promise<StreamSource | null> {
    try {
      // First try fetching stream info PNG or JSON
      const res = await fetch(`${BASE_URL}/DramaList/Episode/${episodeId}.png?sub=true`);
      if (!res.ok) {
        throw new Error(`Failed to fetch episode stream endpoint: ${res.status}`);
      }

      const data = await res.json();
      
      const rawVideoUrl = data.Video || data.video || (data.sources && data.sources[0] && data.sources[0].file) || '';
      
      if (!rawVideoUrl) {
        throw new Error('No video stream URL in response');
      }

      // Direct HLS Video URL (Intercepted by Electron webRequest)
      const videoProxyUrl = rawVideoUrl;

      // Parse Subtitles
      const subtitles: SubtitleTrack[] = [];
      if (Array.isArray(data.subtitles)) {
        data.subtitles.forEach((sub: any, idx: number) => {
          const rawSubSrc = sub.src || sub.url;
          if (rawSubSrc) {
            const proxiedSrc = rawSubSrc; // Intercepted natively by webRequest

            subtitles.push({
              id: sub.id || idx,
              label: sub.label || sub.land || sub.language || `Subtitle ${idx + 1}`,
              src: proxiedSrc,
              land: sub.land || sub.language || 'en',
              default: sub.default || idx === 0
            });
          }
        });
      }

      // Fetch Community S3 Cloud Subtitles if running in Electron
      if (window.electronAPI && window.electronAPI.getCloudSubtitles) {
        try {
          const cloudRes = await window.electronAPI.getCloudSubtitles(episodeId);
          if (cloudRes && Array.isArray(cloudRes.subtitles)) {
            cloudRes.subtitles.forEach((cloudSub) => {
              subtitles.unshift(cloudSub); // Put S3 cloud subtitles at top of list
            });
          }
        } catch (e) {
          console.error('[API] Failed to fetch cloud subtitles:', e);
        }
      }

      return {
        url: videoProxyUrl,
        subtitles
      };
    } catch (err) {
      console.error('[API] getEpisodeStream error:', err);
      return null;
    }
  }
};
