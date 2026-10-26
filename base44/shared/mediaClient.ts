import { secrets } from "base44:runtime";

// Media rendering runs on the owner's own provider. Nothing in this module can
// reach Base44's image or video engines, so a render never spends platform credits.
//
// Point it at any OpenAI-compatible media endpoint with four secrets:
//   MEDIA_BASE_URL     e.g. https://your-provider/v1
//   MEDIA_API_KEY      the key that provider issued
//   MEDIA_IMAGE_MODEL  the text-to-image model to call
//   MEDIA_VIDEO_MODEL  the text-to-video model to call
// With the media secrets empty the app reports "not connected" and spends nothing.

const REQUEST_TIMEOUT_MS = 120000;

export const MEDIA_NOT_CONNECTED = 'media_not_connected';

function getSecret(name) {
  try {
    return secrets.get(name) || "";
  } catch {
    return "";
  }
}

export function mediaConfig() {
  const baseUrl = getSecret("MEDIA_BASE_URL").replace(/\/+$/, "");
  const apiKey = getSecret("MEDIA_API_KEY");
  return {
    baseUrl,
    apiKey,
    imageModel: getSecret("MEDIA_IMAGE_MODEL"),
    videoModel: getSecret("MEDIA_VIDEO_MODEL"),
    configured: Boolean(baseUrl && apiKey),
  };
}

/** What the app can render right now, for the operator and their agent. */
export function mediaStatus() {
  const config = mediaConfig();
  return {
    connected: config.configured && Boolean(config.imageModel || config.videoModel),
    images: config.configured && Boolean(config.imageModel),
    video: config.configured && Boolean(config.videoModel),
    note: config.configured
      ? 'Rendering runs on the configured media provider. Base44 credits are never used.'
      : 'No media provider is configured. Set MEDIA_BASE_URL, MEDIA_API_KEY and the model names in the app secrets.',
  };
}

function notConnected(what) {
  const error = new Error(
    `No ${what} renderer is connected. Set MEDIA_BASE_URL, MEDIA_API_KEY and ${what === 'image' ? 'MEDIA_IMAGE_MODEL' : 'MEDIA_VIDEO_MODEL'} in the app secrets to render on your own provider. No platform credits were spent.`
  );
  error.code = MEDIA_NOT_CONNECTED;
  return error;
}

async function call(config, path, body, method = "POST") {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `The media provider rejected the request (HTTP ${response.status}): ${String(text).slice(0, 200)}`
    );
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The media provider returned a response that was not JSON.");
  }
}

const SIZES = { "1:1": "1024x1024", "16:9": "1792x1024", "9:16": "1024x1792" };

/** One image, rendered and stored by the owner's provider, returned as a URL. */
export async function renderMediaImage({ prompt, aspect = "1:1", referenceUrls = [] } = {}) {
  const config = mediaConfig();
  if (!config.configured || !config.imageModel) throw notConnected("image");

  const text = String(prompt || "").trim();
  if (!text) throw new Error("A prompt is required to render an image.");

  const body = {
    model: config.imageModel,
    prompt: text,
    n: 1,
    size: SIZES[aspect] || SIZES["1:1"],
    response_format: "url",
  };
  if (referenceUrls.length) body.reference_image_urls = referenceUrls;

  const payload = await call(config, "/images/generations", body);
  const item = payload?.data?.[0] || payload?.images?.[0] || {};
  const url = item?.url || item?.image_url || (typeof item === "string" ? item : "");
  if (!url) throw new Error("The media provider returned no image URL.");
  return url;
}

/** Video is a job: submit it, then ask for its status until it hands back a URL. */
export async function submitMediaVideo({ prompt, aspect = "9:16", seconds = 6, firstFrameUrl = "" } = {}) {
  const config = mediaConfig();
  if (!config.configured || !config.videoModel) throw notConnected("video");

  const text = String(prompt || "").trim();
  if (!text) throw new Error("A prompt is required to render a video.");

  const body = {
    model: config.videoModel,
    prompt: text,
    seconds: Number(seconds) || 6,
    aspect_ratio: aspect,
  };
  // The post's own image opens the clip, so the video continues the plan rather
  // than starting from a blank prompt.
  if (firstFrameUrl) {
    body.frame_images = [{ type: "image_url", image_url: { url: firstFrameUrl }, frame_type: "first_frame" }];
  }

  const payload = await call(config, "/videos", body);
  const id = payload?.id || payload?.job_id || payload?.video_id || "";
  if (!id) throw new Error("The video provider did not return a job id.");
  return id;
}

/** The provider's own words for the job: its status, its URL and its error. */
export async function readMediaVideo(jobId) {
  const config = mediaConfig();
  if (!config.configured) throw notConnected("video");
  if (!jobId) throw new Error("A video job id is required.");

  const payload = await call(config, `/videos/${encodeURIComponent(jobId)}`, null, "GET");
  return {
    status: String(payload?.status || payload?.state || "unknown"),
    url: payload?.url || payload?.video_url || payload?.output?.[0]?.url || "",
    error: String(payload?.error?.message || payload?.error || ""),
  };
}

/** The model name on a video job record, so the record matches what really rendered. */
export function mediaVideoModel() {
  return mediaConfig().videoModel || "";
}