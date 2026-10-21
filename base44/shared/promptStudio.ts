// The prompt transformer. One sentence from the owner goes in; briefs the image,
// video and writing engines can all run come out. The house rules live here so
// every engine asks for the same look, voice and limits.

export const TRANSFORM_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x'];

export const HOUSE_VISUAL_RULES = `- Describe only what the camera sees: subject, action, setting, camera movement, lighting, mood, style.
- Never put words, lettering, logos or on-screen text in the image. Video and image engines render text badly.
- Two to four concrete, physical sentences. No slogans, no abstractions.`;

export const HOUSE_CONTENT_RULES = `- caption: platform-native, 2 to 4 short lines, at most 3 emojis, ending on a clear call to action.
- hook: one scroll-stopping line, under 12 words.
- hashtags: 8 to 12 tags in one string, each starting with #, mixing broad and specific ones.
- call_to_action: one short imperative line.
- Never invent prices, awards, dates, statistics, reviews, certifications or offers that were not supplied.`;

export function businessBlock(business, discovery) {
  const research = discovery
    ? `WHAT THE RESEARCH ALREADY FOUND
Positioning: ${discovery.positioning || 'not established'}
Services: ${(discovery.services || []).map((s) => s.name).filter(Boolean).join(', ') || 'not listed'}`
    : 'WHAT THE RESEARCH ALREADY FOUND: nothing yet.';

  return `BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
Description: ${business.description || 'not specified'}
Services: ${business.services || 'not specified'}
Target audience: ${business.target_audience || 'not specified'}
Brand tone: ${business.tone || 'professional'}
Brand colours: ${business.brand_colors || 'not specified'}

${research}`;
}

export function buildTransformerPrompt({ sentence, business, discovery, platforms }) {
  return `You are the prompt engine inside Auto Social, an autonomous content system. The owner has given you one raw sentence. Turn it into ready-to-run briefs.

${businessBlock(business, discovery)}

THE OWNER'S SENTENCE
${sentence}

Produce all four of these:
- image_prompt: a photorealistic brief for one still image.
- video_prompt: a brief for a short vertical video, describing camera and motion.
- content: the single best post for this business, with title, hook, caption, hashtags and call_to_action.
- social_angles: the same idea rewritten natively for up to three of these platforms: ${platforms.join(', ')}. One entry per platform with platform, hook, caption, hashtags and call_to_action. Each must read as if written for that platform, not copied between them.

VISUAL RULES
${HOUSE_VISUAL_RULES}

WRITING RULES
${HOUSE_CONTENT_RULES}

Stay faithful to the owner's sentence and never invent facts it does not contain.`;
}

export const TRANSFORM_SCHEMA = {
  type: 'object',
  properties: {
    image_prompt: { type: 'string' },
    video_prompt: { type: 'string' },
    content: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        hook: { type: 'string' },
        caption: { type: 'string' },
        hashtags: { type: 'string' },
        call_to_action: { type: 'string' },
      },
      required: ['caption'],
    },
    social_angles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          platform: { type: 'string' },
          hook: { type: 'string' },
          caption: { type: 'string' },
          hashtags: { type: 'string' },
          call_to_action: { type: 'string' },
        },
        required: ['platform', 'caption'],
      },
    },
  },
  required: ['image_prompt', 'content'],
};