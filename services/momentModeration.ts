export interface ModerationResult {
  approved: boolean;
  reason?: string;
  provider: string;
}

export async function moderateMoment(input: {
  imageUrl?: string;
  caption?: string;
}): Promise<ModerationResult> {
  const endpoint = String(process.env.NF_MOMENTS_MODERATION_URL ?? '').trim();
  if (!endpoint) {
    return { approved: true, provider: 'none' };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: input.imageUrl ?? '',
        caption: input.caption ?? ''
      })
    });
    if (!res.ok) {
      return { approved: true, provider: 'fallback', reason: `status_${res.status}` };
    }
    const data = await res.json();
    const approved = data?.approved !== false;
    return { approved, provider: 'custom', reason: data?.reason };
  } catch {
    return { approved: true, provider: 'fallback', reason: 'error' };
  }
}
