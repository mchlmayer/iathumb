import { GoogleGenAI, Modality } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates an image from a text prompt using the Imagen model.
 * Best for high-quality initial creations from text.
 */
export const generateImageWithText = async (prompt: string): Promise<string> => {
  try {
    console.log("Generating image with prompt (Imagen):", prompt);
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '16:9',
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("A API não retornou nenhuma imagem.");
    }

    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    
    if (!base64ImageBytes) {
        throw new Error("Os dados da imagem recebidos estão vazios.");
    }

    return base64ImageBytes;

  } catch (error) {
    console.error("Error calling Imagen API:", error);
    if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
          throw new Error("Você atingiu o limite de requisições (quota). Por favor, aguarde um minuto e tente novamente.");
        }
        throw new Error(`Falha ao gerar imagem: ${error.message}`);
    }
    throw new Error("Um erro inesperado ocorreu durante a geração da imagem.");
  }
};


/**
 * Generates or edits an image based on a text prompt and reference images using the Gemini Flash Image model.
 * Best for editing an existing image or creating a new one based on references.
 */
export const generateImageWithReference = async (
    prompt: string, 
    images: Array<{ data: string; mimeType: string }>
): Promise<string> => {
    try {
        // Enforce aspect ratio via prompt for models that don't have a config setting for it.
        // The instruction is made very explicit to override the model's tendency to copy the reference image's aspect ratio.
        const enhancedPrompt = `The final output image MUST have a 16:9 aspect ratio, perfect for a YouTube thumbnail. IMPORTANT: Ignore the aspect ratio of any reference images provided. Now, fulfill this request: ${prompt}`;
        console.log("Generating/editing image with reference(s) (Gemini Flash Image):", enhancedPrompt);

        const imageParts = images.map(image => ({
            inlineData: {
                data: image.data,
                mimeType: image.mimeType,
            },
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [ ...imageParts, { text: enhancedPrompt } ] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const candidate = response.candidates?.[0];

        if (!candidate || !candidate.content || !candidate.content.parts) {
             // A common reason for an empty response is safety blocking.
             if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                throw new Error(`A geração da imagem foi interrompida. Motivo: ${candidate.finishReason}`);
             }
             throw new Error("A resposta da API não continha o conteúdo esperado ou foi bloqueada.");
        }

        for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return part.inlineData.data;
            }
        }

        throw new Error("A API não retornou uma imagem no formato esperado.");

    } catch (error) {
        console.error("Error calling Gemini Flash Image API:", error);
        if (error instanceof Error) {
            if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
                throw new Error("Você atingiu o limite de requisições (quota). Por favor, aguarde um minuto e tente novamente.");
            }
            throw new Error(`Falha ao gerar/editar imagem com referência: ${error.message}`);
        }
        throw new Error("Um erro inesperado ocorreu durante a geração/edição da imagem.");
    }
};