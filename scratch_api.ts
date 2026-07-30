import { Drama, Episode, StreamSource, SubtitleTrack } from '../types/tv';

const BASE_URL = '/api';

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
      return data.map(item => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail,
        episodesCount: item.episodesCount,
        score: item.score,
        status: item.status,
        country: item.country,
        description: item.description
      }));
    } catch (err) {
      console.error('[API] getFeatured error:', err);
      return [];
    }
  },

  // 2. Recent Updates
  async getRecentUpdates(): Promise<Drama[]> {
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/LastUpdate?ispc=false`);
      return data.map(item => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail,
        episodesCount: item.episodesCount,
        score: item.score,
        status: item.status,
        country: item.country
      }));
    } catch (err) {
      console.error('[API] getRecentUpdates error:', err);
      return [];
    }
  },

  // 3. Trending (Most Search)
  async getTrending(): Promise<Drama[]> {
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/MostSearch?ispc=false`);
      return data.map(item => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail,
        episodesCount: item.episodesCount,
        score: item.score,
        status: item.status
      }));
    } catch (err) {
      console.error('[API] getTrending error:', err);
      return [];
    }
  },

  // 4. Top Rated
  async getTopRated(): Promise<Drama[]> {
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/TopRating?ispc=false`);
      return data.map(item => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail,
        score: item.score,
        status: item.status
      }));
    } catch (err) {
      console.error('[API] getTopRated error:', err);
      return [];
    }
  },

  // 5. Search
  async searchDramas(query: string): Promise<Drama[]> {
    if (!query.trim()) return [];
    try {
      const data = await fetchJson<any[]>(`${BASE_URL}/DramaList/Search?q=${encodeURIComponent(query.trim())}`);
      return data.map(item => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail,
        episodesCount: item.episodesCount,
        score: item.score,
        status: item.status,
        country: item.country || (query.toLowerCase().includes('korea') ? 'South Korea' : query.toLowerCase().includes('china') ? 'China' : undefined)
      }));
    } catch (err) {
      console.error('[API] searchDramas error:', err);
      return [];
    }
  },

  // 5.1 Category Specific Fetching
  async getDramasByCategory(cat: string): Promise<Drama[]> {
    try {
      let query = '';
      if (cat === 'kdrama') query = 'Korea';
      else if (cat === 'cdrama') query = 'China';
      else if (cat === 'anime') query = 'Anime';
      else if (cat === 'movies') query = 'Movie';
      if (!query) return [];

      return await this.searchDramas(query);
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

      return {
        id: data.id,
        title: data.title,
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
      
      let rawVideoUrl = data.Video || data.video || (data.sources && data.sources[0] && data.sources[0].file) || '';
      
      if (!rawVideoUrl) {
        throw new Error('No video stream URL in response');
      }

      // Convert raw M3U8 stream URL into same-origin video-proxy URL
      const videoProxyUrl = `/video-proxy?url=${encodeURIComponent(rawVideoUrl)}`;

      // Parse Subtitles
      const subtitles: SubtitleTrack[] = [];
      if (Array.isArray(data.subtitles)) {
        data.subtitles.forEach((sub: any, idx: number) => {
          const rawSubSrc = sub.src || sub.url;
          if (rawSubSrc) {
            const proxiedSrc = rawSubSrc.startsWith('http')
              ? `/api/proxy-subtitle?url=${encodeURIComponent(rawSubSrc)}`
              : rawSubSrc;

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
