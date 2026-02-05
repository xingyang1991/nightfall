const DEFAULT_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/images/search';

function getConfig() {
  const enabled = String(process.env.NF_IMAGE_SEARCH_ENABLED ?? '').trim().toLowerCase() === 'true';
  if (!enabled) return null;
  const key = String(process.env.BING_IMAGE_SEARCH_KEY ?? '').trim();
  const endpoint = String(process.env.BING_IMAGE_SEARCH_ENDPOINT ?? DEFAULT_ENDPOINT).trim();
  if (!key) return null;
  return { key, endpoint };
}

export async function searchImage(query: string): Promise<string | null> {
  const config = getConfig();
  if (!config || !query) return null;

  const url = new URL(config.endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('safeSearch', 'Moderate');
  url.searchParams.set('imageType', 'Photo');
  url.searchParams.set('size', 'Large');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'Ocp-Apim-Subscription-Key': config.key
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data?.value) ? data.value[0] : null;
    const urlResult = String(first?.contentUrl ?? '').trim();
    return urlResult || null;
  } catch {
    return null;
  }
}
