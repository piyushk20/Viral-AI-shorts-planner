import { GoogleGenAI } from '@google/genai';
import { Genre, Duration, Idea } from '../types';
import { SYSTEM_PROMPT, SCRIPT_SYSTEM_PROMPT, getFinalizeScriptJsonPrompt, TRENDING_TOPICS_PROMPT } from '../constants';

const getGenAIClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};


export const generateShortsIdeas = async (genre: Genre, duration: Duration): Promise<string> => {
  const ai = getGenAIClient();
  const userPrompt = `Generate 10 ${genre} ideas for a ${duration} video.`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: SYSTEM_PROMPT,
        },
    });

    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate ideas from Gemini API.");
  }
};

export const generateScriptForIdea = async (
  idea: Idea,
  sceneDuration: string,
  noNarration: boolean,
  previousScript?: string,
  suggestion?: string
): Promise<string> => {
  const ai = getGenAIClient();
  
  const noNarrationConstraint = noNarration ? '**Constraint:** No Narration Required.\n' : '';

  let userPrompt: string;
  if (previousScript && suggestion) {
    userPrompt = `Based on the original idea and the first version of the script below, please generate a revised script that incorporates the user's suggestions.

**Original Idea:**
- **Title:** ${idea.title}
- **Concept:** ${idea.concept}
- **Genre:** ${idea.genre}

**First Script Version:**
${previousScript}

**User Suggestion for Revision:**
"${suggestion}"

${noNarrationConstraint}
Please maintain the same Markdown table format and adhere to the target duration of **${sceneDuration}**.
`;
  } else {
    userPrompt = `Generate a production-ready script for the following idea.
  
**Idea Title:** ${idea.title}
**Concept:** ${idea.concept}
**Story Arc:** ${idea.storyArc}
**Genre:** ${idea.genre}

${noNarrationConstraint}
The target duration for this scene is **${sceneDuration}**.
`;
  }

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: SCRIPT_SYSTEM_PROMPT,
        },
    });

    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for script generation:", error);
    throw new Error("Failed to generate script from Gemini API.");
  }
};

export const finalizeScriptAsJson = async (finalScript: string, sceneDuration: string): Promise<string> => {
    const ai = getGenAIClient();
    const userPrompt = `Please convert the following script into the specified JSON format.
    
    **Script:**
    ${finalScript}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: getFinalizeScriptJsonPrompt(sceneDuration),
            },
        });
        
        // The model should return a raw JSON string. Let's try to trim any potential markdown fences.
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.substring(7);
        }
        if (jsonText.endsWith('```')) {
            jsonText = jsonText.substring(0, jsonText.length - 3);
        }
        
        return jsonText.trim();

    } catch (error) {
        console.error("Error calling Gemini API for script finalization:", error);
        throw new Error("Failed to finalize script as JSON from Gemini API.");
    }
};

export const generateVideoForIdea = async (idea: Idea, visualStyle: string, musicMood: string): Promise<string> => {
  const ai = getGenAIClient();
  const prompt = `
    Create a short video based on the following detailed creative brief.

    **Title:** ${idea.title}
    **Core Concept:** ${idea.concept}
    **Detailed Cues:** ${idea.visualsAndAudio}

    **Mandatory Creative Direction:**
    - **Visual Style:** Adhere strictly to a **${visualStyle}** aesthetic.
    - **Audio Direction:** ${musicMood === 'No Music' ? 'The video must not contain any background music. Rely only on sound effects as described in the cues.' : `The video's soundtrack must be instrumental music with a clear **${musicMood}** mood.`}
  `;

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

    if (!downloadLink) {
        throw new Error("Video generation succeeded but no download link was found.");
    }
    
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable is not set for downloading video.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);

  } catch (error) {
    console.error("Error calling Veo API for video generation:", error);
    if (error instanceof Error) {
        throw new Error(`${error.message}`);
    }
    throw new Error("Failed to generate video from Veo API due to an unknown error.");
  }
};

export const getTrendingTopics = async (genres: Genre[]): Promise<string[]> => {
    const ai = getGenAIClient();
    const userPrompt = `Analyze trends for: ${genres.join(', ')}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: TRENDING_TOPICS_PROMPT,
            },
        });
        const topicsText = response.text.trim();
        if (!topicsText) return [];
        return topicsText.split(',').map(topic => topic.trim().toLowerCase());
    } catch (error) {
        console.error("Error calling Gemini API for trending topics:", error);
        throw new Error("Failed to get trending topics from Gemini API.");
    }
};
