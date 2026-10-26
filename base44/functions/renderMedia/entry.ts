import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveBusiness } from '../../shared/access.ts';
import {
  MEDIA_NOT_CONNECTED,
  mediaStatus,
  readMediaVideo,
  renderMediaImage,
  submitMediaVideo,
} from '../../shared/mediaClient.ts';

// The browser's only route to media. It renders on the media provider configured for
// this app and never calls Base44's image or video engines, so no platform credits
// are spent. Actions: image, video, video_status, status.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    if (body?.action === 'status') return Response.json(mediaStatus());

    if (body?.business_id) {
      const access = await resolveBusiness(base44, body.business_id);
      if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
    }

    if (body?.action === 'video_status') {
      return Response.json(await readMediaVideo(String(body?.job_id || '')));
    }

    const prompt = String(body?.prompt || '').trim();
    if (!prompt) return Response.json({ error: 'A prompt is required.' }, { status: 400 });

    if (body?.kind === 'video') {
      const jobId = await submitMediaVideo({
        prompt,
        aspect: body?.aspect_ratio || '9:16',
        seconds: Number(body?.seconds) || 6,
        firstFrameUrl: body?.first_frame_url || '',
      });
      return Response.json({ job_id: jobId, status: 'queued' });
    }

    const url = await renderMediaImage({
      prompt,
      aspect: body?.aspect_ratio || '1:1',
      referenceUrls: Array.isArray(body?.reference_urls) ? body.reference_urls.slice(0, 3) : [],
    });
    return Response.json({ url });
  } catch (error) {
    if (error?.code === MEDIA_NOT_CONNECTED) {
      return Response.json({ error: error.message });
    }
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 502 });
  }
}